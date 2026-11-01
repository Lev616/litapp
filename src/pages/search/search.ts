import { Component, ViewChild } from '@angular/core';
import { IonicPage, NavController, NavParams, PopoverController } from 'ionic-angular';
import { Keyboard } from '@ionic-native/keyboard';

import { Storage } from '@ionic/storage';

import { STARREDQUERIES_KEY, RECENTQUERIES_KEY, SEARCHFILTERS_KEY } from '../../providers/db';
import { StoryFilter, DEFAULT_STORY_FILTER, filterStories, isFilterActive } from '../../app/story-filter';
import { Story } from '../../models/story';
import { Stories, Settings, History } from '../../providers/providers';

@IonicPage({ priority: 'high' })
@Component({
  selector: 'page-search',
  templateUrl: 'search.html',
})
export class SearchPage {
  @ViewChild('searchbar') searchbar: any;
  @ViewChild('panel') panel: any;
  @ViewChild('list') list: any;

  currentStories: Story[] = [];
  recentQueries: string[] = [];
  starredQueries: string[] = [];
  query: string;
  storyurl: string;
  totalResults: number;
  currentpage: number = 1;

  filters: StoryFilter = { ...DEFAULT_STORY_FILTER };

  options = {
    sort: '',
    languages: undefined,
    category: undefined,
    popular: false,
    editorsChoice: false,
    winner: false,
    astags: false,
  };

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    public stories: Stories,
    public settings: Settings,
    public history: History,
    public storage: Storage,
    private popoverCtrl: PopoverController,
    private keyboard: Keyboard,
  ) {
    this.query = navParams.get('query');
    this.storyurl = navParams.get('storyurl');
    this.storage.get(RECENTQUERIES_KEY).then(value => {
      if (value) {
        this.recentQueries = value;
      }
    });
    this.storage.get(STARREDQUERIES_KEY).then(value => {
      if (value) {
        this.starredQueries = value;
      }
    });

    this.storage.get(SEARCHFILTERS_KEY).then(value => {
      if (value) {
        this.filters = { ...DEFAULT_STORY_FILTER, ...value };
      }
    });

    this.settings.load().then(() => (this.options.languages = [this.settings.allSettings.defaultLanguage]));
  }

  ionViewDidEnter() {
    this.keyboard.disableScroll(true);
  }

  ionViewWillLeave() {
    this.keyboard.disableScroll(false);
  }

  ionViewWillEnter() {
    if (this.query) {
      this.options.astags = true;
      this.options.sort = 'views';
      this.options.category = '';
      this.search(this.query);
    } else if (this.storyurl) {
      this.search(this.storyurl);
    } else if (this.searchbar.value === '') {
      setTimeout(() => {
        this.searchbar.setFocus();
      }, 100);
    }
  }

  getStories(query?: string) {
    this.panel.close();
    const val = query ? query : this.searchbar.value;
    if (!val || !val.trim() || val.length < 3) return;

    this.currentStories = [];
    this.list.enableInfinity();
    this.currentpage = 1;
    this.stories.searchStory(val.trim(), this.options, 1).subscribe(data => {
      this.totalResults = data[1];
      this.currentStories = this.applyFilters(data[0]);
      // when the filter hid the whole first page, keep fetching so the list isn't empty
      if (!this.currentStories.length && data[0].length) this.fetchUntilResults(val.trim());
    });
    this.saveSearch(query);
  }

  loadMore(event) {
    this.fetchNextPage(this.searchbar.value, event, 0);
  }

  // Loads the next page; skips ahead (max 5 pages) when filters removed everything on a page.
  private fetchNextPage(query: string, event: any, depth: number) {
    this.currentpage += 1;
    this.stories.searchStory(query, { ...this.options }, this.currentpage).subscribe(data => {
      // use the raw length to detect the end of the results, not the filtered one
      if (!data[0].length) {
        event.enable(false);
        return;
      }
      const filtered = this.applyFilters(data[0]);
      filtered.forEach(s => this.currentStories.push(s));
      if (!filtered.length && depth < 5) {
        this.fetchNextPage(query, event, depth + 1);
        return;
      }
      event.complete();
    });
  }

  private fetchUntilResults(query: string) {
    const fake = { enable: () => {}, complete: () => {} };
    this.fetchNextPage(query, fake, 0);
  }

  applyFilters(stories: Story[]): Story[] {
    return filterStories(stories, this.filters, this.history.getIds());
  }

  hasActiveFilters(): boolean {
    return isFilterActive(this.filters);
  }

  saveSearch(query: string) {
    if (!query) return;

    const newQuery = query.trim();
    if (newQuery.length < 2) return;
    if (this.recentQueries.indexOf(newQuery) > -1) return;
    if (this.starredQueries.indexOf(newQuery) > -1) return;
    this.recentQueries.push(newQuery);
    this.storage.set(RECENTQUERIES_KEY, this.recentQueries);
  }

  pinSearch(event, query: string) {
    event.stopPropagation();
    if (this.starredQueries.indexOf(query) > -1) return;
    this.starredQueries.push(query);
    this.recentQueries.splice(this.recentQueries.indexOf(query), 1);
    this.storage.set(STARREDQUERIES_KEY, this.starredQueries);
    this.storage.set(RECENTQUERIES_KEY, this.recentQueries);
  }

  search(query: string) {
    this.searchbar.value = query;
    this.getStories(query);
  }

  delete(event, query: string) {
    event.stopPropagation();
    if (this.recentQueries.indexOf(query) > -1) {
      this.recentQueries.forEach((item, index) => {
        if (item === query) {
          this.recentQueries.splice(index, 1);
        }
      });
      this.storage.set(RECENTQUERIES_KEY, this.recentQueries);
    } else if (this.starredQueries.indexOf(query) > -1) {
      this.starredQueries.forEach((item, index) => {
        if (item === query) {
          this.starredQueries.splice(index, 1);
        }
      });
      this.storage.set(STARREDQUERIES_KEY, this.starredQueries);
    }
  }

  openOptionsPopover(ev: UIEvent) {
    const popover = this.popoverCtrl.create('SearchPopover', {
      options: this.options,
      filters: this.filters,
    });

    popover.present({
      ev,
    });

    popover.onDidDismiss(refresh => {
      if (refresh) {
        this.storage.set(SEARCHFILTERS_KEY, this.filters);
      }
      if (this.searchbar.value && refresh) {
        this.getStories();
      }
    });
  }
}
