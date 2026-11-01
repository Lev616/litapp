import { Story } from '../models/story';

export interface StoryFilter {
  minRating: number; // 0 = off
  minViews: number; // 0 = off
  hideRead: boolean;
  hideDownloaded: boolean;
  excludeWords: string; // comma separated, matched against title/description/tags/category
  excludeAuthors: string; // comma separated author names
}

export const DEFAULT_STORY_FILTER: StoryFilter = {
  minRating: 0,
  minViews: 0,
  hideRead: false,
  hideDownloaded: false,
  excludeWords: '',
  excludeAuthors: '',
};

const splitList = (s: string): string[] =>
  (s || '')
    .toLowerCase()
    .split(',')
    .map(x => x.trim())
    .filter(x => x.length > 0);

export const isFilterActive = (f: StoryFilter): boolean => {
  if (!f) return false;
  const hasWords = splitList(f.excludeWords).length > 0;
  const hasAuthors = splitList(f.excludeAuthors).length > 0;
  return f.minRating > 0 || f.minViews > 0 || f.hideRead || f.hideDownloaded || hasWords || hasAuthors;
};

/**
 * Client-side filtering of an already fetched page of stories.
 * Note: search results from the API don't include tags, so excluded words only match
 * title, description, category and tags (when known, e.g. after a story was opened).
 */
export const filterStories = (stories: Story[], f: StoryFilter, readIds: string[] = []): Story[] => {
  if (!isFilterActive(f)) return stories;

  const words = splitList(f.excludeWords);
  const authors = splitList(f.excludeAuthors);
  const read = {};
  readIds.forEach(id => (read[String(id)] = true));

  return stories.filter(s => {
    if (f.minRating > 0) {
      const rating = parseFloat(String(s.rating));
      if (isNaN(rating) || rating < f.minRating) return false;
    }
    if (f.minViews > 0) {
      const views = parseInt(String(s.viewcount), 10);
      if (isNaN(views) || views < f.minViews) return false;
    }
    if (f.hideRead && read[String(s.id)]) return false;
    if (f.hideDownloaded && s.downloaded) return false;

    if (authors.length > 0) {
      const name = ((s.author && s.author.name) || '').toLowerCase();
      if (authors.indexOf(name) > -1) return false;
    }

    if (words.length > 0) {
      const haystack = [s.title, s.description, s.category, (s.tags || []).join(' ')].join(' ').toLowerCase();
      if (words.some(w => haystack.indexOf(w) > -1)) return false;
    }

    return true;
  });
};
