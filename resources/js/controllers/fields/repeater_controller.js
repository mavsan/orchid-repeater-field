import {Controller} from "stimulus"

import dragula from "dragula";

let sqrl = require('squirrelly');

let $ = global.$;

export default class extends Controller {
    /**
     * @type {string[]}
     */
    static targets = [
        "template",
        "repeaterContainer",
        "repeaterBlockCount",
        "addBlockButton"
    ];

    template;
    options = {
        required: false,
        min: null,
        max: null
    };

    connect() {
        //We not needed work with this on preview
        if (document.documentElement.hasAttribute("data-turbolinks-preview")) {
            return;
        }

        this.options = Object.assign(this.options, JSON.parse(this.data.get('options')));

        console.log(this.options);

        sqrl.autoEscaping(false);
        this.template = sqrl.Compile(this.templateTarget.innerHTML);
        this.fetchFields();
        this.initDragDrop();
    }

    /**
     * Retrieving fields from the backend if they are exists
     */
    fetchFields() {
        let self = this,
            field_name = this.data.get('name'),
            value = JSON.parse(this.data.get('value'));

        axios.post(this.data.get('url'), {
            value: value,
            repeater_name: field_name
        }).then((r) => {
            r.data.results.forEach((v, k) => {
                if (self.options.max === null || k < self.options.max) {
                    let content = v.join('', v);
                    self.repeaterContainerTarget.insertAdjacentHTML('beforeend', self.template({
                        content: content,
                        block_key: k,
                        block_count: k + 1
                    }));
                }
            });

            $('[data-toggle="tooltip"]').tooltip();

            self.initMinRequiredBlock();
        });
    }

    initMinRequiredBlock() {
        console.log('Init min or required blocks');

        //Exit when required or min aren't set
        if (this.options.required !== true && !this.options.min) {
            return;
        }

        let blocksCount = this.repeaterContainerTarget.querySelectorAll('.repeater-item').length;

        console.log(`Blocks count ${blocksCount}`);

        if (!blocksCount && this.options.required === true && this.options.min === null) {
            this.options.min = 1;
        }

        if (this.options.min !== null && this.options.min > blocksCount) {
            console.log('min set');
            const click = new CustomEvent('click', {
                detail: {
                    blocksNum: this.options.min - blocksCount
                }
            });

            this.addBlockButtonTarget.dispatchEvent(click);
        }
    }

    /**
     * Initialize drag n' drop ability
     */
    initDragDrop() {
        let self = this;

        dragula([this.repeaterContainerTarget], {
            moves: function (el, container, handle) {
                return handle.classList.contains('card-handle');
            }
        }).on('drop', function () {
            self.sort();
        });
    }

    /**
     * Adding new blocks based on number of blocks which we have right now
     */
    addBlock(event) {
        let blocksCount = this.repeaterContainerTarget.querySelectorAll('.repeater-item').length,
            currentBlock = event.currentTarget.closest('.repeater-item'),
            num = event.detail.blocksNum || 1;

        if (this.options.max && blocksCount >= this.options.max) {
            alert(`Maximum number of blocks reached`);
            return;
        }

        axios.post(this.data.get('url'), {
            repeater_name: this.data.get('name'),
            blocks: blocksCount,
            num: num
        }).then((r) => {
            let key = blocksCount;
            r.data.results.forEach((v, k) => {
                let content = v.join('', v),
                    compiledTemplate = this.template({
                        content: content,
                        block_key: key,
                        block_count: key + 1
                    });

                if (currentBlock !== null) {
                    currentBlock.insertAdjacentHTML('afterend', compiledTemplate);
                } else {
                    this.repeaterContainerTarget.insertAdjacentHTML('beforeend', compiledTemplate);
                }

                key++;
            });

            $('[data-toggle="tooltip"]').tooltip();

            this.sort();
        });
    }

    /**
     * Delete specified block based on event
     *
     * @param event
     */
    deleteBlock(event) {
        let blocksCount = this.repeaterContainerTarget.querySelectorAll('.repeater-item').length;

        if (this.options.min && blocksCount <= this.options.min) {
            alert(`Minimum number of blocks reached`);
            return;
        }

        $(event.currentTarget).parents('.repeater-item').remove();

        this.sort();
    }

    /**
     * Sorting nested fields
     *
     * TODO: Do we need create a labels for the blocks based on new order or not?
     */
    sort() {
        let repeater_field_name = this.data.get('name'),
            blocks = this.repeaterContainerTarget.querySelectorAll('.repeater-item');

        blocks.forEach((block, currentKey) => {
            block.dataset.sort = currentKey;
            const fields = block.querySelectorAll('[data-repeater-name-key]');

            if (!fields.length) {
                return;
            }

            fields.forEach((field) => {
                let repeaterNameKey = field.dataset.repeaterNameKey,
                    originalName = '[' + repeaterNameKey.replace('.', '') + ']';

                if (repeaterNameKey.endsWith('.')) {
                    originalName += '[]';
                }

                field.setAttribute('name', repeater_field_name + '[' + currentKey + ']' + originalName);
            })
        });

        if (this.hasRepeaterBlockCountTarget) {
            this.repeaterBlockCountTargets.forEach((v, k) => {
                v.innerHTML = k + 1;
            })
        }
    }

    disconnect() {
        this.repeaterContainerTarget.innerHTML = '';
        this.template = null;
    }

}