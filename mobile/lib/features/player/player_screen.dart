import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import '../../core/models/song.dart';
import '../../core/services/radio_service.dart';
import '../../core/services/chat_service.dart';
import 'widgets/chat_panel.dart';

class PlayerScreen extends StatefulWidget {
  const PlayerScreen({super.key});

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  final RadioService _radioService = RadioService();
  Song? _currentSong;
  bool _isPlaying = false;
  bool _isLoading = true;
  bool _isLiked = false;
  bool _isLikeLoading = false;
  bool _isChatExpanded = false;

  @override
  void initState() {
    super.initState();
    // Force landscape for a split player + chat view that fits without scrolling.
    SystemChrome.setPreferredOrientations(const [
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    _loadNextTrack();
    _audioPlayer.playerStateStream.listen((state) {
      if (state.processingState == ProcessingState.completed) {
        _loadNextTrack();
      }
    });
  }

  Future<void> _loadNextTrack() async {
    setState(() {
      _isLoading = true;
      _isLiked = false;
    });

    try {
      final song = await _radioService.getNextTrack();
      if (song != null) {
        await _audioPlayer.setUrl(song.audioUrl);
        await _audioPlayer.play();
        await _radioService.reportPlay(song.id);
        
        // Check if song is liked
        final liked = await _radioService.isLiked(song.id);
        
        setState(() {
          _currentSong = song;
          _isPlaying = true;
          _isLoading = false;
          _isLiked = liked;
        });
      } else {
        setState(() {
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading track: $e')),
        );
      }
    }
  }

  Future<void> _toggleLike() async {
    if (_currentSong == null || _isLikeLoading) return;

    setState(() {
      _isLikeLoading = true;
    });

    try {
      final liked = await _radioService.toggleLike(_currentSong!.id);
      setState(() {
        _isLiked = liked;
        _isLikeLoading = false;
      });
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(liked ? 'Added to favorites!' : 'Removed from favorites'),
            duration: const Duration(seconds: 1),
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLikeLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    }
  }

  Future<void> _togglePlayPause() async {
    if (_isPlaying) {
      await _audioPlayer.pause();
    } else {
      await _audioPlayer.play();
    }
    setState(() {
      _isPlaying = !_isPlaying;
    });
  }

  Future<void> _skipTrack() async {
    if (_currentSong != null) {
      await _radioService.reportPlay(_currentSong!.id, skipped: true);
    }
    await _audioPlayer.stop();
    _loadNextTrack();
  }

  @override
  void dispose() {
    // Restore default orientation behavior when leaving the player.
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    _audioPlayer.dispose();
    super.dispose();
  }

  void _toggleChat() {
    setState(() {
      _isChatExpanded = !_isChatExpanded;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ChatService()..initialize(),
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Radio'),
          backgroundColor: Colors.deepPurple,
          foregroundColor: Colors.white,
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _currentSong == null
                ? const Center(child: Text('No tracks available'))
                : OrientationBuilder(
                    builder: (context, orientation) {
                      // Primary target: landscape split view with horizontal player + chat dock.
                      if (orientation == Orientation.landscape) {
                        return Column(
                          children: [
                            Expanded(
                              flex: 3,
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.center,
                                  children: [
                                    AspectRatio(
                                      aspectRatio: 1,
                                      child: ClipRRect(
                                        borderRadius: BorderRadius.circular(16),
                                        child: _currentSong!.artworkUrl != null
                                            ? CachedNetworkImage(
                                                imageUrl: _currentSong!.artworkUrl!,
                                                fit: BoxFit.cover,
                                                placeholder: (context, url) =>
                                                    const Center(child: CircularProgressIndicator()),
                                                errorWidget: (context, url, error) =>
                                                    const Icon(Icons.music_note, size: 64),
                                              )
                                            : const ColoredBox(
                                                color: Colors.black12,
                                                child: Center(
                                                  child: Icon(Icons.music_note, size: 64),
                                                ),
                                              ),
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Text(
                                            _currentSong!.title,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: Theme.of(context).textTheme.headlineSmall,
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            _currentSong!.artistName,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: Theme.of(context).textTheme.titleMedium,
                                          ),
                                          const SizedBox(height: 12),
                                          Row(
                                            children: [
                                              IconButton(
                                                icon: const Icon(Icons.skip_previous),
                                                iconSize: 34,
                                                onPressed: null, // Not implemented in MVP
                                              ),
                                              const SizedBox(width: 8),
                                              IconButton(
                                                icon: Icon(
                                                  _isPlaying ? Icons.pause_circle : Icons.play_circle,
                                                ),
                                                iconSize: 52,
                                                onPressed: _togglePlayPause,
                                              ),
                                              const SizedBox(width: 8),
                                              IconButton(
                                                icon: const Icon(Icons.skip_next),
                                                iconSize: 34,
                                                onPressed: _skipTrack,
                                              ),
                                              const Spacer(),
                                              IconButton(
                                                icon: _isLikeLoading
                                                    ? const SizedBox(
                                                        width: 22,
                                                        height: 22,
                                                        child: CircularProgressIndicator(strokeWidth: 2),
                                                      )
                                                    : Icon(
                                                        _isLiked ? Icons.favorite : Icons.favorite_border,
                                                        color: _isLiked ? Colors.red : Colors.grey.shade600,
                                                      ),
                                                iconSize: 28,
                                                onPressed: _isLikeLoading ? null : _toggleLike,
                                                tooltip: _isLiked
                                                    ? 'Remove from favorites'
                                                    : 'Add to favorites',
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            Expanded(
                              flex: 4,
                              child: ChatPanel(
                                currentSongId: _currentSong?.id,
                                currentSongTitle: _currentSong?.title,
                                // In landscape we always show chat and size it to the remaining height.
                                isExpanded: true,
                                onToggleExpand: null,
                                fillHeightWhenExpanded: true,
                              ),
                            ),
                          ],
                        );
                      }

                      // Portrait fallback (keeps chat collapsible).
                      return Column(
                        children: [
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SizedBox(
                                    width: 220,
                                    height: 220,
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(16),
                                      child: _currentSong!.artworkUrl != null
                                          ? CachedNetworkImage(
                                              imageUrl: _currentSong!.artworkUrl!,
                                              fit: BoxFit.cover,
                                              placeholder: (context, url) =>
                                                  const Center(child: CircularProgressIndicator()),
                                              errorWidget: (context, url, error) =>
                                                  const Icon(Icons.music_note, size: 64),
                                            )
                                          : const ColoredBox(
                                              color: Colors.black12,
                                              child: Center(child: Icon(Icons.music_note, size: 64)),
                                            ),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    _currentSong!.title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context).textTheme.headlineSmall,
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    _currentSong!.artistName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: Theme.of(context).textTheme.titleMedium,
                                    textAlign: TextAlign.center,
                                  ),
                                  const SizedBox(height: 12),
                                  IconButton(
                                    icon: _isLikeLoading
                                        ? const SizedBox(
                                            width: 28,
                                            height: 28,
                                            child: CircularProgressIndicator(strokeWidth: 2),
                                          )
                                        : Icon(
                                            _isLiked ? Icons.favorite : Icons.favorite_border,
                                            color: _isLiked ? Colors.red : Colors.grey.shade600,
                                          ),
                                    iconSize: 32,
                                    onPressed: _isLikeLoading ? null : _toggleLike,
                                    tooltip: _isLiked ? 'Remove from favorites' : 'Add to favorites',
                                  ),
                                ],
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.skip_previous),
                                  iconSize: 40,
                                  onPressed: null, // Not implemented in MVP
                                ),
                                const SizedBox(width: 18),
                                IconButton(
                                  icon: Icon(_isPlaying ? Icons.pause_circle : Icons.play_circle),
                                  iconSize: 56,
                                  onPressed: _togglePlayPause,
                                ),
                                const SizedBox(width: 18),
                                IconButton(
                                  icon: const Icon(Icons.skip_next),
                                  iconSize: 40,
                                  onPressed: _skipTrack,
                                ),
                              ],
                            ),
                          ),
                          ChatPanel(
                            currentSongId: _currentSong?.id,
                            currentSongTitle: _currentSong?.title,
                            isExpanded: _isChatExpanded,
                            onToggleExpand: _toggleChat,
                          ),
                        ],
                      );
                    },
                  ),
      ),
    );
  }
}
