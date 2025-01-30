'use strict';

(() => {
	/** Adapted from https://kyleshevlin.com/how-to-write-your-own-javascript-dom-element-factory/ */
	const elFactory = (type, attributes, ...children) => {
		const el = document.createElement(type);

		for (const key in attributes) {
			el.setAttribute(key, attributes[key]);
		}

		children.forEach(child => {
			if (typeof child === 'string') {
				el.appendChild(document.createTextNode(child))
			} else {
				el.appendChild(child)
			}
		});

		return el
	};
	
	const h = elFactory;
	
	const getEventTarget = event => event.target || event.srcElement;
	
	const newTd = (...children) => h('td', {}, ...children);
	const newDiv = (...children) => h('div', {}, ...children);
	
	const newInput = (type, attributes) => h('input', { type, ...attributes });
	const newCheckbox = attributes => newInput('checkbox', { ...attributes });
	
	const newDataCheckbox = (object, attrName, attributes = {}) => {
		const checkbox = newCheckbox(attributes);
		
		checkbox.checked = object[attrName];
		checkbox.addEventListener('click', e => {
			const target = getEventTarget(e);
			object[attrName] = target.checked;
			console.log('Clicked on checkbox', { checked: target.checked, object });					
		});
		
		return checkbox;
	}
	
	window.DomUtil = {
		h, getEventTarget,
		newTd, newDiv, 
		newInput, newCheckbox,
		newDataCheckbox
	};
})();