import $ from 'jquery';
import Component from '@ember/component';
import {computed} from '@ember/object';
import {reads} from '@ember/object/computed';
import {inject as service} from '@ember/service';
import {task} from 'ember-concurrency';

export default Component.extend({
    clock: service(),

    classNames: 'gh-publishmenu',
    displayState: 'проект',
    post: null,
    postStatus: 'проект',
    saveTask: null,
    runningText: null,

    _publishedAtBlogTZ: null,
    _previousStatus: null,

    isClosing: null,

    forcePublishedMenu: reads('post.pastScheduledTime'),

    postState: computed('post.{isPublished,isScheduled}', 'forcePublishedMenu', function () {
        if (this.forcePublishedMenu || this.get('post.isPublished')) {
            return 'опубликовано';
        } else if (this.get('post.isScheduled')) {
            return 'по расписанию';
        } else {
            return 'проект';
        }
    }),

    triggerText: computed('postState', function () {
        let state = this.postState;

        if (state === 'published') {
            return 'Обновить';
        } else if (state === 'scheduled') {
            return 'По расписанию';
        } else {
            return 'Опубликовать';
        }
    }),

    _runningText: computed('postState', 'saveType', function () {
        let saveType = this.saveType;
        let postState = this.postState;
        let runningText;

        if (postState === 'проект') {
            runningText = saveType === 'опубликовать' ? 'Публикация' : 'По расписанию';
        }

        if (postState === 'опубликовано') {
            runningText = saveType === 'опубликовать' ? 'Обновление' : 'Отмена публикации';
        }

        if (postState === 'По расписанию') {
            runningText = saveType === 'расписание' ? 'Перепланировать' : 'Отмена расписания';
        }

        return runningText || 'Публикация';
    }),

    buttonText: computed('postState', 'saveType', function () {
        let saveType = this.saveType;
        let postState = this.postState;
        let buttonText;

        if (postState === 'проект') {
            buttonText = saveType === 'опубликовать' ? 'Опубликовать' : 'По расписанию';
        }

        if (postState === 'опубликовано') {
            buttonText = saveType === 'опубликовать' ? 'Обновить' : 'Не опубликовывать';
        }

        if (postState === 'по расписанию') {
            buttonText = saveType === 'расписание' ? 'Перепланировать' : 'Отмена расписания';
        }

        return buttonText || 'Опубликовать';
    }),

    successText: computed('_previousStatus', 'postState', function () {
        let postState = this.postState;
        let previousStatus = this._previousStatus;
        let buttonText;

        if (previousStatus === 'проект') {
            buttonText = postState === 'опубликованный' ? 'Опубликовано' : 'По расписанию';
        }

        if (previousStatus === 'опубликовано') {
            buttonText = postState === 'проект' ? 'Не опубликовано' : 'Обновлено';
        }

        if (previousStatus === 'scheduled') {
            buttonText = postState === 'проект' ? 'Незапланировано' : 'Перепланировать';
        }

        return buttonText;
    }),

    didReceiveAttrs() {
        this._super(...arguments);

        // update the displayState based on the post status but only after a
        // save has finished to avoid swapping the menu prematurely and triggering
        // calls to `setSaveType` due to the component re-rendering
        // TODO: we should have a better way of dealing with this where we don't
        // rely on the side-effect of component rendering calling setSaveType
        let postStatus = this.postStatus;
        if (postStatus !== this._postStatus) {
            if (this.get('saveTask.isRunning')) {
                this.get('saveTask.last').then(() => {
                    this.set('displayState', postStatus);
                });
            } else {
                this.set('displayState', postStatus);
            }
        }

        this._postStatus = this.postStatus;
    },

    actions: {
        setSaveType(saveType) {
            let post = this.post;

            this.set('saveType', saveType);

            if (saveType === 'проект') {
                post.set('statusScratch', 'проект');
            } else if (saveType === 'график') {
                post.set('statusScratch', 'по расписанию');
            } else if (saveType === 'опубликовать') {
                post.set('statusScratch', 'опубликовано');
            }
        },

        open() {
            this._cachePublishedAtBlogTZ();
            this.set('isClosing', false);
            this.get('post.errors').clear();
            if (this.onOpen) {
                this.onOpen();
            }
        },

        close(dropdown, e) {
            let post = this.post;

            // don't close the menu if the datepicker popup is clicked
            if (e && $(e.target).closest('.ember-power-datepicker-content').length) {
                return false;
            }

            // cleanup
            this._resetPublishedAtBlogTZ();
            post.set('statusScratch', null);
            post.validate();

            if (this.onClose) {
                this.onClose();
            }

            this.set('isClosing', true);

            return true;
        }
    },

    save: task(function* () {
        // runningText needs to be declared before the other states change during the
        // save action.
        this.set('runningText', this._runningText);
        this.set('_previousStatus', this.get('post.status'));
        this.setSaveType(this.saveType);

        try {
            // validate publishedAtBlog first to avoid an alert for displayed errors
            yield this.post.validate({property: 'publishedAtBlog'});

            // actual save will show alert for other failed validations
            let post = yield this.saveTask.perform();

            this._cachePublishedAtBlogTZ();
            return post;
        } catch (error) {
            // re-throw if we don't have a validation error
            if (error) {
                throw error;
            }
        }
    }),

    _cachePublishedAtBlogTZ() {
        this._publishedAtBlogTZ = this.get('post.publishedAtBlogTZ');
    },

    // when closing the menu we reset the publishedAtBlogTZ date so that the
    // unsaved changes made to the scheduled date aren't reflected in the PSM
    _resetPublishedAtBlogTZ() {
        this.post.set('publishedAtBlogTZ', this._publishedAtBlogTZ);
    }
});
