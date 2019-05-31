import ModalComponent from 'ghost-admin/components/modal-base';
import {inject as service} from '@ember/service';
import {task} from 'ember-concurrency';

export default ModalComponent.extend({

    ghostPaths: service(),
    notifications: service(),
    store: service(),
    ajax: service(),

    actions: {
        confirm() {
            this.deleteAll.perform();
        }
    },

    _deleteAll() {
        let deleteUrl = this.get('ghostPaths.url').api('db');
        return this.ajax.del(deleteUrl);
    },

    _unloadData() {
        this.store.unloadAll('пост');
        this.store.unloadAll('тег');
    },

    _showSuccess() {
        this.notifications.showAlert('Весь контент удален из базы данных.', {type: 'успешно', key: 'all-content.delete.success'});
    },

    _showFailure(error) {
        this.notifications.showAPIError(error, {key: 'all-content.delete'});
    },

    deleteAll: task(function* () {
        try {
            yield this._deleteAll();
            this._unloadData();
            this._showSuccess();
        } catch (error) {
            this._showFailure(error);
        } finally {
            this.send('closeModal');
        }
    }).drop()
});
