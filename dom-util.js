'use strict';

(() => {
	/** Adapted from https://kyleshevlin.com/how-to-write-your-own-javascript-dom-element-factory/ */
	const elFactory = (type, attributes, ...children) => {
		const el = document.createElement(type);

		for (const key in attributes) {
			if (key.startsWith('@')) {
				const eventName = key.slice(1);
				el.addEventListener(eventName, attributes[key]);
			} else if (key.startsWith('.')) {
				const propertyName = key.slice(1);
				el[propertyName] = attributes[key];
			} else {
				el.setAttribute(key, attributes[key]);
			}
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
	const newLabel = (...children) => h('label', {}, ...children);
	
	const newInput = (type, attributes) => h('input', { type, ...attributes });
	const newCheckbox = attributes => newInput('checkbox', { ...attributes });
	
	const newDataCheckbox = (object, attrName, attributes = {}) => {
		const handleClick = e => {
			const target = getEventTarget(e);
			object[attrName] = target.checked;
			attributes['@afterclick'] && attributes['@afterclick']({ event: e, object, target });
		}
		
		const checkbox = newCheckbox({
			'@click': handleClick, 
			'.checked': object[attrName],
			...attributes
		});
		
		return checkbox;
	}
	
	const populateModalDialog = (dialog, title, ...contents) => {
		const closePopupButton = h('button', {'@click': () => dialog.close() }, 'Close popup');
			
		const popupHeader = h('h4', {}, 
			title,
			closePopupButton
		);

		dialog.innerHTML = '';
		dialog.appendChild(popupHeader);
		contents && contents.forEach(el => dialog.appendChild(el));
		dialog.showModal();
	}
	
	window.DomUtil = {
		h, getEventTarget,
		newTd, newDiv, newLabel,
		newInput, newCheckbox,
		newDataCheckbox,
		populateModalDialog
	};
})();