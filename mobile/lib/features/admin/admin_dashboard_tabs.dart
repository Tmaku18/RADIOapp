part of 'admin_dashboard_screen.dart';

extension AdminDashboardTabs on _AdminDashboardScreenState {
  Widget _buildOverviewTab() {
    final active = _liveStatus['active'] == true;
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            SizedBox(width: 220, child: _metricTile('Total Users', _analytics['totalUsers'], Icons.people_alt_outlined)),
            SizedBox(width: 220, child: _metricTile('Total Artists', _analytics['totalArtists'], Icons.mic_outlined)),
            SizedBox(width: 220, child: _metricTile('Total Songs', _analytics['totalSongs'], Icons.music_note_outlined)),
            SizedBox(width: 220, child: _metricTile(AnalyticsMetrics.earsReached.label, _analytics['earsReached'] ?? 0, Icons.favorite_border)),
            SizedBox(width: 220, child: _metricTile(AnalyticsMetrics.listens.label, _analytics['totalListenCount'] ?? _analytics['listens'] ?? 0, Icons.hearing_outlined)),
            SizedBox(width: 220, child: _metricTile('Pending Songs', _analytics['pendingSongs'], Icons.hourglass_top_outlined)),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: Icon(active ? Icons.sensors : Icons.sensors_off),
            title: Text(active ? 'Live broadcast is active' : 'Live broadcast is offline'),
            subtitle: Text(active ? 'Tap to stop current live broadcast.' : 'Tap to start a platform live broadcast.'),
            trailing: FilledButton(
              onPressed: _liveActionLoading ? null : _toggleLive,
              child: Text(_liveActionLoading ? 'Working...' : (active ? 'Stop' : 'Go live')),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.mail_outline),
            title: const Text('Email TestFlight beta invite'),
            subtitle: const Text(
              'Send every user the iPhone beta link — join, upload songs, send feedback.',
            ),
            trailing: FilledButton.tonal(
              onPressed: _sendTestFlightBetaInvite,
              child: const Text('Email all'),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.system_update_alt_outlined),
            title: const Text('Notify users of an app update'),
            subtitle: const Text(
              'Publish a release and push “update available” to all devices.',
            ),
            trailing: FilledButton.tonal(
              onPressed: _publishAppUpdate,
              child: const Text('Broadcast'),
            ),
          ),
        ),
      ],
    );
  }
  Widget _buildSongsTab() {
    final filters = const [
      'pending',
      'approved',
      'rejected',
      'all',
      'copyrighted',
    ];
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _songSearchCtrl,
                onSubmitted: (_) => _refreshSongs(),
                decoration: const InputDecoration(
                  labelText: 'Search songs by title',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _refreshSongs, child: const Text('Search')),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: filters
              .map(
                (f) => ChoiceChip(
                  label: Text(f[0].toUpperCase() + f.substring(1)),
                  selected: _songStatusFilter == f,
                  onSelected: (_) async {
                    setState(() => _songStatusFilter = f);
                    await _refreshSongs();
                  },
                ),
              )
              .toList(),
        ),
        if (_songStatusFilter == 'copyrighted') ...[
          const SizedBox(height: 8),
          Text(
            'Showing songs auto-flagged for a copyright match. Review before keeping them rejected or approving if the artist owns the rights.',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.65),
              fontSize: 12,
            ),
          ),
        ],
        const SizedBox(height: 8),
        Text(
          _songs.isEmpty
              ? (_songStatusFilter == 'copyrighted'
                  ? 'No copyright-flagged songs found.'
                  : 'No songs for this filter.')
              : '${_songs.length} song(s)',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.65)),
        ),
        const SizedBox(height: 12),
        ..._songs.map((song) {
          final id = _songField(song, 'id');
          final title = _songField(song, 'title').isEmpty
              ? 'Untitled'
              : _songField(song, 'title');
          final artist = _songField(song, 'artist_name', 'artistName').isEmpty
              ? 'Unknown artist'
              : _songField(song, 'artist_name', 'artistName');
          final status = _songField(song, 'status').isEmpty
              ? 'unknown'
              : _songField(song, 'status').toLowerCase();
          final duration = song['duration_seconds'] ?? song['durationSeconds'];
          final audioUrl = _songField(song, 'audio_url', 'audioUrl');
          final isPreviewing =
              _previewingSongId == id && _previewPlayer.playing;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                    '$artist · $status${duration != null ? ' · ${duration}s' : ''}',
                    style: const TextStyle(color: Colors.grey),
                  ),
                  if (_copyrightMatchLine(song).isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        _copyrightMatchLine(song),
                        style: TextStyle(
                          color: Colors.orange.shade200,
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ),
                  Builder(
                    builder: (_) {
                      final stations = stationIdsFromSongMap(song);
                      final labels = stationLabelsForIds(stations);
                      if (labels.isEmpty) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Stations: $labels',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.55),
                            fontSize: 12,
                          ),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FilledButton.tonalIcon(
                        onPressed: audioUrl.isEmpty
                            ? null
                            : () => _togglePreview(song),
                        icon: Icon(
                          isPreviewing ? Icons.pause : Icons.play_arrow,
                        ),
                        label: Text(isPreviewing ? 'Pause' : 'Play'),
                      ),
                      // Hide once decided — Approve gone when approved, Reject when rejected.
                      if (status != 'approved')
                        OutlinedButton(
                          onPressed: _songActionBusy
                              ? null
                              : () => _approveSong(song),
                          child: const Text('Approve'),
                        ),
                      if (status != 'rejected')
                        OutlinedButton(
                          onPressed: _songActionBusy
                              ? null
                              : () => _rejectSong(id, title),
                          child: const Text('Reject'),
                        ),
                      OutlinedButton(
                        onPressed: _songActionBusy
                            ? null
                            : () => _editSongMetadata(song),
                        child: const Text('Edit'),
                      ),
                      OutlinedButton(
                        onPressed: _songActionBusy
                            ? null
                            : () => _runSongAction(
                                  () => _admin.toggleFreeRotation(
                                    id,
                                    song['admin_free_rotation'] != true,
                                  ),
                                  'Free rotation updated.',
                                ),
                        child: const Text('Free Rotation'),
                      ),
                      OutlinedButton(
                        onPressed: () => _showTrimDialog(
                          id,
                          title,
                          audioUrl: audioUrl,
                          durationSeconds: (duration is num)
                              ? duration.toInt()
                              : int.tryParse('$duration'),
                        ),
                        child: const Text('Trim'),
                      ),
                      OutlinedButton(
                        onPressed: audioUrl.isEmpty
                            ? null
                            : () => _openAdminSampleTrim(song),
                        child: const Text('Sample'),
                      ),
                      OutlinedButton(
                        onPressed: audioUrl.isEmpty
                            ? null
                            : () => _openAdminDiscoverClip(song),
                        child: const Text('Discover clip'),
                      ),
                      TextButton(
                        onPressed: _songActionBusy
                            ? null
                            : () => _runSongAction(
                                  () => _admin.deleteSong(id),
                                  'Song deleted.',
                                ),
                        child: const Text('Delete'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
  Widget _buildQueueTab() {
    final nowTitle = _nowPlaying?['title'];
    final nowArtist = _nowPlaying?['artistName'];
    final candidateItems = _queueAddCandidates
        .map(_candidateStackId)
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Text(
          'Queue Manager',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 4),
        Text(
          'Manage upcoming queue and skip the current track when needed.',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.65)),
        ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton.tonal(
            onPressed: _skipCurrentTrack,
            child: const Text('Skip Current Track'),
          ),
        ),
        const SizedBox(height: 12),
        if (_radios.isNotEmpty)
          DropdownButtonFormField<String>(
            value: _radios.any((r) => r.id == _selectedRadioId)
                ? _selectedRadioId
                : _radios.first.id,
            decoration: const InputDecoration(
              labelText: 'Station',
              border: OutlineInputBorder(),
              isDense: true,
            ),
            items: _radios
                .map(
                  (r) => DropdownMenuItem(
                    value: r.id,
                    child: Text(
                      r.label.isNotEmpty ? r.label : r.id,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            onChanged: (id) async {
              if (id == null || id == _selectedRadioId) return;
              setState(() => _selectedRadioId = id);
              await _refreshQueue();
            },
          ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Now Playing',
                  style: TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text(
                  nowTitle == null
                      ? 'No active track'
                      : '$nowTitle — ${nowArtist ?? 'Unknown artist'}',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.75),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Add Eligible Song',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white.withValues(alpha: 0.65),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  key: ValueKey<String?>(_selectedAddStackId),
                  initialValue: candidateItems.contains(_selectedAddStackId)
                      ? _selectedAddStackId
                      : null,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    isDense: true,
                  ),
                  items: _queueAddCandidates
                      .where((c) => _candidateStackId(c).isNotEmpty)
                      .map((c) {
                    final id = _candidateStackId(c);
                    return DropdownMenuItem<String>(
                      value: id,
                      child: Text(
                        '${_candidateTitle(c)} — ${_candidateArtist(c)}',
                        overflow: TextOverflow.ellipsis,
                      ),
                    );
                  }).toList(),
                  onChanged: (v) => setState(() => _selectedAddStackId = v),
                ),
                const SizedBox(height: 10),
                FilledButton(
                  onPressed: _selectedAddStackId == null
                      ? null
                      : _addSelectedToQueueDraft,
                  child: const Text('Add to Draft Queue'),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Upcoming Queue (Draft)',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    TextButton(
                      onPressed:
                          _queueHasChanges ? _resetQueueDraft : null,
                      child: const Text('Reset'),
                    ),
                    const SizedBox(width: 4),
                    FilledButton(
                      onPressed:
                          _queueHasChanges ? _saveQueueDraft : null,
                      child: const Text('Apply Queue Changes'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (_queueDraft.isEmpty)
                  Text(
                    'No upcoming entries.',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.65),
                    ),
                  )
                else
                  ...List.generate(_queueDraft.length, (idx) {
                    final entry = _queueDraft[idx];
                    final title = entry.title.trim().isEmpty
                        ? entry.stackId
                        : entry.title;
                    final artist = entry.artistName.trim().isEmpty
                        ? 'Unknown artist'
                        : entry.artistName;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.12),
                          ),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            SizedBox(
                              width: 36,
                              child: Text(
                                '#${idx + 1}',
                                style: TextStyle(
                                  color:
                                      Colors.white.withValues(alpha: 0.55),
                                ),
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    artist,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.white
                                          .withValues(alpha: 0.55),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              tooltip: 'Up',
                              onPressed: idx == 0
                                  ? null
                                  : () => _moveQueueDraft(idx, -1),
                              icon: const Icon(Icons.arrow_upward, size: 18),
                            ),
                            IconButton(
                              tooltip: 'Down',
                              onPressed: idx >= _queueDraft.length - 1
                                  ? null
                                  : () => _moveQueueDraft(idx, 1),
                              icon:
                                  const Icon(Icons.arrow_downward, size: 18),
                            ),
                            IconButton(
                              tooltip: 'Remove',
                              onPressed: () => _removeQueueDraftAt(idx),
                              icon: const Icon(
                                Icons.delete_outline,
                                size: 18,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
                const SizedBox(height: 4),
                TextButton(
                  onPressed: () {
                    setState(() {
                      _showRawStackEditor = !_showRawStackEditor;
                      if (_showRawStackEditor) _syncQueueDraftCtrl();
                    });
                  },
                  child: Text(
                    _showRawStackEditor
                        ? 'Hide stack ID editor'
                        : 'Advanced: edit stack IDs',
                  ),
                ),
                if (_showRawStackEditor) ...[
                  TextField(
                    controller: _queueDraftCtrl,
                    minLines: 4,
                    maxLines: 10,
                    decoration: const InputDecoration(
                      labelText: 'Queue stack IDs (one per line)',
                      border: OutlineInputBorder(),
                    ),
                    onChanged: (_) {},
                  ),
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () {
                      _applyRawStackIdsToDraft();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Draft updated from stack IDs.'),
                        ),
                      );
                    },
                    child: const Text('Apply IDs to draft'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
  Widget _buildUsersTab() {
    final roles = const ['all', 'artist', 'listener', 'admin', 'dj', 'musician'];
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _userSearchCtrl,
                onSubmitted: (_) => _refreshUsers(),
                decoration: const InputDecoration(
                  labelText: 'Search users / artists (name or email)',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(onPressed: _refreshUsers, child: const Text('Search')),
          ],
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: roles
              .map(
                (r) => ChoiceChip(
                  label: Text(r[0].toUpperCase() + r.substring(1)),
                  selected: _userRoleFilter == r,
                  onSelected: (_) async {
                    setState(() => _userRoleFilter = r);
                    await _refreshUsers();
                  },
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 8),
        Text(
          _users.isEmpty
              ? 'No users for this filter.'
              : '${_users.length} user(s)',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.65)),
        ),
        const SizedBox(height: 12),
        ..._users.map((user) {
          final userId = '${user['id']}';
          final role = '${user['role'] ?? 'listener'}';
          final isShadowBanned = user['is_shadow_banned'] == true;
          final isBanned = user['is_banned'] == true;
          final canStream = user['canStream'] == true || role == 'admin';
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${user['display_name'] ?? 'Unnamed'}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Text('${user['email'] ?? ''} · $role'),
                  if (isShadowBanned || isBanned || canStream) ...[
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (canStream)
                          Chip(
                            label: Text(
                              role == 'admin'
                                  ? 'Streamer (admin)'
                                  : 'Streamer',
                            ),
                            visualDensity: VisualDensity.compact,
                            backgroundColor: Colors.teal.withValues(alpha: 0.25),
                          ),
                        if (isShadowBanned)
                          Chip(
                            label: const Text('Shadow banned'),
                            visualDensity: VisualDensity.compact,
                            backgroundColor: Colors.amber.withValues(
                              alpha: 0.25,
                            ),
                          ),
                        if (isBanned)
                          Chip(
                            label: const Text('Banned'),
                            visualDensity: VisualDensity.compact,
                            backgroundColor: Colors.red.withValues(alpha: 0.25),
                          ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FilledButton.tonal(
                        onPressed: () => _openUserDetail(user),
                        child: const Text('Open / Songs'),
                      ),
                      OutlinedButton(
                        onPressed: () async {
                          try {
                            await _admin.updateUserRole(
                              userId,
                              role == 'artist' ? 'listener' : 'artist',
                            );
                            await _refreshUsers();
                          } catch (e) {
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Role update failed: $e')),
                            );
                          }
                        },
                        child: Text(
                          role == 'artist' ? 'Make Listener' : 'Make Artist',
                        ),
                      ),
                      if (role != 'admin')
                        OutlinedButton(
                          onPressed: () => _setUserStreamerAccess(
                            user,
                            grant: !canStream,
                          ),
                          child: Text(
                            canStream ? 'Revoke Streamer' : 'Grant Streamer',
                          ),
                        ),
                      if (!isShadowBanned)
                        OutlinedButton(
                          onPressed: () => _confirmShadowBan(user),
                          child: const Text('Shadow Ban'),
                        ),
                      if (isShadowBanned || isBanned)
                        OutlinedButton(
                          onPressed: () => _confirmRestoreUser(user),
                          child: const Text('Restore'),
                        ),
                      OutlinedButton(
                        onPressed: () => _confirmLifetimeBan(user),
                        child: const Text('Lifetime Ban'),
                      ),
                      TextButton(
                        onPressed: () => _confirmDeleteUserAccount(user),
                        child: const Text('Delete Account'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
  Widget _buildSwipeFeedTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        const Text('Swipe cards', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(
          'Play the published Discover clip or edit the 5–15s window.',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.65)),
        ),
        const SizedBox(height: 8),
        if (_swipeCards.isEmpty)
          Text(
            'No swipe clips yet.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.65)),
          ),
        ..._swipeCards.map((card) {
          final songId = '${card['songId'] ?? ''}';
          final title = '${card['title'] ?? 'Untitled'}';
          final artist =
              '${card['artistDisplayName'] ?? card['artistName'] ?? ''}';
          final clipUrl = _songField(card, 'clip_url', 'clipUrl');
          final audioUrl = _songField(card, 'audio_url', 'audioUrl');
          final start = _asDouble(
            card['clipStartSeconds'] ?? card['clip_start_seconds'],
          );
          final end = _asDouble(
            card['clipEndSeconds'] ?? card['clip_end_seconds'],
          );
          final range = start != null && end != null && end > start
              ? '${clipFmtTime(start)} – ${clipFmtTime(end)}'
              : 'Range not set';
          final isPreviewing =
              _previewingSongId == songId && _previewPlayer.playing;
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                    artist.isEmpty ? range : '$artist · $range',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.65)),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FilledButton.tonalIcon(
                        onPressed: clipUrl.isEmpty && audioUrl.isEmpty
                            ? null
                            : () => _togglePreview({
                                  'id': songId,
                                  'audioUrl':
                                      clipUrl.isNotEmpty ? clipUrl : audioUrl,
                                }),
                        icon: Icon(
                          isPreviewing ? Icons.pause : Icons.play_arrow,
                        ),
                        label: Text(isPreviewing ? 'Pause' : 'Play clip'),
                      ),
                      OutlinedButton(
                        onPressed: audioUrl.isEmpty
                            ? null
                            : () => _openSwipeClipEditor(card),
                        child: const Text('Edit clip'),
                      ),
                      TextButton(
                        onPressed: songId.isEmpty
                            ? null
                            : () => _deleteSwipeClip(songId),
                        child: const Text('Delete clip'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
        const SizedBox(height: 14),
        const Text('Feed media moderation', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ..._feedMedia.map(
          (item) {
            final provider = item['provider'];
            final providerName = provider is Map
                ? '${provider['displayName'] ?? provider['display_name'] ?? 'Unknown'}'
                : '${item['authorDisplayName'] ?? 'Unknown'}';
            final caption =
                '${item['description'] ?? item['title'] ?? item['caption'] ?? ''}';
            return Card(
            child: ListTile(
              title: Text(providerName),
              subtitle: Text(caption),
              trailing: Wrap(
                spacing: 4,
                children: [
                  TextButton(
                    onPressed: () async {
                      await _admin.removeFromFeed('${item['id']}');
                      final feed = await _admin.getFeedMedia();
                      if (!mounted) return;
                      setState(() => _feedMedia = feed);
                    },
                    child: const Text('Remove'),
                  ),
                  TextButton(
                    onPressed: () async {
                      await _admin.deleteFeedMedia('${item['id']}');
                      final feed = await _admin.getFeedMedia();
                      if (!mounted) return;
                      setState(() => _feedMedia = feed);
                    },
                    child: const Text('Delete'),
                  ),
                ],
              ),
            ),
          );
          },
        ),
      ],
    );
  }
  Widget _buildFallbackRotationTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        const Text('Fallback upload (from storage paths)', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        TextField(controller: _fallbackTitleCtrl, decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _fallbackArtistCtrl, decoration: const InputDecoration(labelText: 'Artist name', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _fallbackAudioPathCtrl, decoration: const InputDecoration(labelText: 'Audio path', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _fallbackArtworkPathCtrl, decoration: const InputDecoration(labelText: 'Artwork path (optional)', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        TextField(controller: _fallbackDurationCtrl, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Duration seconds (optional)', border: OutlineInputBorder())),
        const SizedBox(height: 8),
        FilledButton(onPressed: _submitFallbackFromUpload, child: const Text('Add Fallback Song')),
        const SizedBox(height: 16),
        const Text('Grouped fallback songs', style: TextStyle(fontWeight: FontWeight.bold)),
        ..._fallbackGroups.map(
          (song) => Card(
            child: ListTile(
              title: Text('${song['title'] ?? ''}'),
              subtitle: Text('${song['artist_name'] ?? ''}'),
              trailing: Wrap(
                spacing: 4,
                children: [
                  TextButton(
                    onPressed: () async {
                      await _admin.updateFallbackSongGroup(
                        '${song['id']}',
                        {'isActive': song['is_active'] != true},
                      );
                      final fallback = await _admin.getFallbackSongsGrouped();
                      if (!mounted) return;
                      setState(() => _fallbackGroups = fallback);
                    },
                    child: const Text('Toggle'),
                  ),
                  TextButton(
                    onPressed: () async {
                      await _admin.deleteFallbackSongGroup('${song['id']}');
                      final fallback = await _admin.getFallbackSongsGrouped();
                      if (!mounted) return;
                      setState(() => _fallbackGroups = fallback);
                    },
                    child: const Text('Delete'),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        const Text('Free rotation', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _freeRotationSearchCtrl,
                decoration: const InputDecoration(
                  labelText: 'Song search (toggle first result)',
                  border: OutlineInputBorder(),
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _searchAndToggleFreeRotation,
              child: const Text('Toggle'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ..._freeRotationSongs.map(
          (song) => ListTile(
            leading: const Icon(Icons.playlist_add_check_circle_outlined),
            title: Text('${song['title'] ?? ''}'),
            subtitle: Text('${song['artist_name'] ?? ''}'),
          ),
        ),
      ],
    );
  }
  Widget _buildStreamersTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        ..._streamerApplications.map(
          (application) => Card(
            child: ListTile(
              title: Text('${application['displayName'] ?? 'Unknown user'}'),
              subtitle: Text('${application['email'] ?? ''}'),
              trailing: Wrap(
                spacing: 4,
                children: [
                  FilledButton.tonal(
                    onPressed: () async {
                      await _admin.setStreamerApproval('${application['userId']}', 'approve');
                      final streamers = await _admin.getStreamerApplications();
                      if (!mounted) return;
                      setState(() => _streamerApplications = streamers);
                    },
                    child: const Text('Approve'),
                  ),
                  TextButton(
                    onPressed: () async {
                      await _admin.setStreamerApproval('${application['userId']}', 'reject');
                      final streamers = await _admin.getStreamerApplications();
                      if (!mounted) return;
                      setState(() => _streamerApplications = streamers);
                    },
                    child: const Text('Reject'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
