import Component from '@ember/component';
import DropdownMixin from 'ghost-admin/mixins/dropdown-mixin';
import {inject as service} from '@ember/service';

export default Component.extend(DropdownMixin, {
    dropdown: service(),

    tagName: 'кнопка',
    attributeBindings: ['ссылка', 'роль'],
    role: 'кнопка',

    // matches with the dropdown this button toggles
    dropdownName: null,

    // Notify dropdown service this dropdown should be toggled
    click(event) {
        this._super(event);
        this.dropdown.toggleDropdown(this.dropdownName, this);

        if (this.tagName === 'a') {
            return false;
        }
    }
});
