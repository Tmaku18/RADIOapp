enum SongSort { newest, oldest, liked, alpha, heard }

int compareBySongSort(
  SongSort sort, {
  required String titleA,
  required String titleB,
  required DateTime createdA,
  required DateTime createdB,
  required int likesA,
  required int likesB,
  required int heardA,
  required int heardB,
}) {
  final titleOrder = titleA.toLowerCase().compareTo(titleB.toLowerCase());
  switch (sort) {
    case SongSort.oldest:
      final byDate = createdA.compareTo(createdB);
      return byDate != 0 ? byDate : titleOrder;
    case SongSort.liked:
      final byLikes = likesB.compareTo(likesA);
      return byLikes != 0 ? byLikes : titleOrder;
    case SongSort.alpha:
      return titleOrder;
    case SongSort.heard:
      final byHeard = heardB.compareTo(heardA);
      return byHeard != 0 ? byHeard : titleOrder;
    case SongSort.newest:
      final byDate = createdB.compareTo(createdA);
      return byDate != 0 ? byDate : titleOrder;
  }
}

const songSortLabels = <SongSort, String>{
  SongSort.newest: 'Newest',
  SongSort.oldest: 'Oldest',
  SongSort.liked: 'Most liked',
  SongSort.alpha: 'Alphabetical',
  SongSort.heard: 'Most heard',
};
