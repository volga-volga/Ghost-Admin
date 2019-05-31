/* global key */
/* eslint-disable camelcase */
import Component from '@ember/component';
import RSVP from 'rsvp';
import {computed} from '@ember/object';
import {isBlank, isEmpty} from '@ember/utils';
import {inject as service} from '@ember/service';
import {task, timeout, waitForProperty} from 'ember-concurrency';

export function computedGroup(category) {
    return computed('контент', 'currentSearch', function () {
        if (!this.currentSearch || !this.content) {
            return [];
        }

        return this.content.filter((item) => {
            let search = this.currentSearch.toString().toLowerCase();

            return (item.category === category) && (item.title.toString().toLowerCase().indexOf(search) >= 0);
        });
    });
}

export default Component.extend({
    store: service('магазин'),
    router: service('маршрутизатор'),
    ajax: service(),
    notifications: service(),

    content: null,
    contentExpiresAt: false,
    contentExpiry: 30000,
    currentSearch: '',
    selection: null,

    posts: computedGroup('Посты'),
    pages: computedGroup('Страницы'),
    users: computedGroup('Пользователи'),
    tags: computedGroup('Теги'),

    groupedContent: computed('посты', 'страницы', 'пользователи', 'теги', function () {
        let groups = [];

        if (!isEmpty(this.posts)) {
            groups.pushObject({groupName: 'Посты', options: this.posts});
        }

        if (!isEmpty(this.pages)) {
            groups.pushObject({groupName: 'Страницы', options: this.pages});
        }

        if (!isEmpty(this.users)) {
            groups.pushObject({groupName: 'Пользователи', options: this.users});
        }

        if (!isEmpty(this.tags)) {
            groups.pushObject({groupName: 'Теги', options: this.tags});
        }

        return groups;
    }),

    init() {
        this._super(...arguments);
        this.content = [];
    },

    actions: {
        openSelected(selected) {
            if (!selected) {
                return;
            }

            if (selected.category === 'Посты') {
                let id = selected.id.replace('post.', '');
                this.router.transitionTo('editor.edit', 'post', id);
            }

            if (selected.category === 'Страницы') {
                let id = selected.id.replace('page.', '');
                this.router.transitionTo('editor.edit', 'страницы', id);
            }

            if (selected.category === 'Пользователи') {
                let id = selected.id.replace('user.', '');
                this.router.transitionTo('staff.user', id);
            }

            if (selected.category === 'Теги') {
                let id = selected.id.replace('tag.', '');
                this.router.transitionTo('settings.tags.tag', id);
            }
        },

        onFocus() {
            this._setKeymasterScope();
        },

        onBlur() {
            this._resetKeymasterScope();
        },

        search(term) {
            return this.performSearch.perform(term);
        }
    },

    performSearch: task(function* (term) {
        if (isBlank(term)) {
            return [];
        }

        // start loading immediately in the background
        this.refreshContent.perform();

        // debounce searches to 200ms to avoid thrashing CPU
        yield timeout(200);

        // wait for any on-going refresh to finish
        if (this.refreshContent.isRunning) {
            yield waitForProperty(this, 'refreshContent.isIdle');
        }

        // set dependent CP term and re-calculate CP
        this.set('currentSearch', term);
        return this.groupedContent;
    }).restartable(),

    refreshContent: task(function* () {
        let promises = [];
        let now = new Date();
        let contentExpiresAt = this.contentExpiresAt;

        if (contentExpiresAt > now) {
            return true;
        }

        this.set('content', []);
        promises.pushObject(this._loadPosts());
        promises.pushObject(this._loadPages());
        promises.pushObject(this._loadUsers());
        promises.pushObject(this._loadTags());

        try {
            yield RSVP.all(promises);
        } catch (error) {
            // eslint-disable-next-line
            console.error(error);
        }

        let contentExpiry = this.contentExpiry;
        this.set('contentExpiresAt', new Date(now.getTime() + contentExpiry));
    }).drop(),

    _loadPosts() {
        let store = this.store;
        let postsUrl = `${store.adapterFor('пост').urlForQuery({}, 'пост')}/`;
        let postsQuery = {fields: 'id,title,page', limit: 'все', status: 'все'};
        let content = this.content;

        return this.ajax.request(postsUrl, {data: postsQuery}).then((posts) => {
            content.pushObjects(posts.posts.map(post => ({
                id: `post.${post.id}`,
                title: post.title,
                category: 'Посты'
            })));
        }).catch((error) => {
            this.notifications.showAPIError(error, {key: 'search.loadPosts.error'});
        });
    },

    _loadPages() {
        let store = this.store;
        let pagesUrl = `${store.adapterFor('страница').urlForQuery({}, 'страница')}/`;
        let pagesQuery = {fields: 'id,title,page', limit: 'все', status: 'все'};
        let content = this.content;

        return this.ajax.request(pagesUrl, {data: pagesQuery}).then((pages) => {
            content.pushObjects(pages.pages.map(page => ({
                id: `page.${page.id}`,
                title: page.title,
                category: 'Страницы'
            })));
        }).catch((error) => {
            this.notifications.showAPIError(error, {key: 'search.loadPosts.error'});
        });
    },

    _loadUsers() {
        let store = this.store;
        let usersUrl = `${store.adapterFor('user').urlForQuery({}, 'пользователь')}/`;
        let usersQuery = {fields: 'name,slug', limit: 'all'};
        let content = this.content;

        return this.ajax.request(usersUrl, {data: usersQuery}).then((users) => {
            content.pushObjects(users.users.map(user => ({
                id: `user.${user.slug}`,
                title: user.name,
                category: 'Пользователи'
            })));
        }).catch((error) => {
            this.notifications.showAPIError(error, {key: 'search.loadUsers.error'});
        });
    },

    _loadTags() {
        let store = this.store;
        let tagsUrl = `${store.adapterFor('tag').urlForQuery({}, 'тег')}/`;
        let tagsQuery = {fields: 'name,slug', limit: 'all'};
        let content = this.content;

        return this.ajax.request(tagsUrl, {data: tagsQuery}).then((tags) => {
            content.pushObjects(tags.tags.map(tag => ({
                id: `tag.${tag.slug}`,
                title: tag.name,
                category: 'Теги'
            })));
        }).catch((error) => {
            this.notifications.showAPIError(error, {key: 'search.loadTags.error'});
        });
    },

    _setKeymasterScope() {
        key.setScope('search-input');
    },

    _resetKeymasterScope() {
        key.setScope('по умолчанию');
    },

    willDestroy() {
        this._super(...arguments);
        this._resetKeymasterScope();
    }
});
