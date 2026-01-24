import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../core/models/song.dart';
import '../../core/services/radio_service.dart';

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

  @override
  void initState() {
    super.initState();
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
    _audioPlayer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Radio'),
        backgroundColor: Colors.deepPurple,
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _currentSong == null
              ? const Center(child: Text('No tracks available'))
              : Column(
                  children: [
                    Expanded(
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (_currentSong!.artworkUrl != null)
                              ClipRRect(
                                borderRadius: BorderRadius.circular(16),
                                child: CachedNetworkImage(
                                  imageUrl: _currentSong!.artworkUrl!,
                                  width: 300,
                                  height: 300,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) =>
                                      const CircularProgressIndicator(),
                                  errorWidget: (context, url, error) =>
                                      const Icon(Icons.music_note, size: 300),
                                ),
                              )
                            else
                              const Icon(Icons.music_note, size: 300),
                            const SizedBox(height: 32),
                            Text(
                              _currentSong!.title,
                              style: Theme.of(context).textTheme.headlineMedium,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _currentSong!.artistName,
                              style: Theme.of(context).textTheme.titleLarge,
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 24),
                            // Like button
                            IconButton(
                              icon: _isLikeLoading
                                  ? const SizedBox(
                                      width: 32,
                                      height: 32,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : Icon(
                                      _isLiked
                                          ? Icons.favorite
                                          : Icons.favorite_border,
                                      color: _isLiked
                                          ? Colors.red
                                          : Colors.grey.shade600,
                                    ),
                              iconSize: 36,
                              onPressed: _isLikeLoading ? null : _toggleLike,
                              tooltip: _isLiked
                                  ? 'Remove from favorites'
                                  : 'Add to favorites',
                            ),
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(32.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.skip_previous),
                            iconSize: 48,
                            onPressed: null, // Not implemented in MVP
                          ),
                          const SizedBox(width: 32),
                          IconButton(
                            icon: Icon(
                              _isPlaying ? Icons.pause_circle : Icons.play_circle,
                            ),
                            iconSize: 64,
                            onPressed: _togglePlayPause,
                          ),
                          const SizedBox(width: 32),
                          IconButton(
                            icon: const Icon(Icons.skip_next),
                            iconSize: 48,
                            onPressed: _skipTrack,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }
}
