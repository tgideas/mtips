/*!
 *  xo v1.0.1 - 11/14/2014
 *  http://xsin.in/xo
 *  Copyright (c) 2014 XSIN Studio - Licensed MIT 
 */
(function () {
	'use strict';

	/**
	 * @preserve FastClick: polyfill to remove click delays on browsers with touch UIs.
	 *
	 * @version 1.0.3
	 * @codingstandard ftlabs-jsv2
	 * @copyright The Financial Times Limited [All Rights Reserved]
	 * @license MIT License (see LICENSE.txt)
	 */

	/*jslint browser:true, node:true*/
	/*global define, Event, Node*/


	/**
	 * Instantiate fast-clicking listeners on the specified layer.
	 *
	 * @constructor
	 * @param {Element} layer The layer to listen on
	 * @param {Object} options The options to override the defaults
	 */
	function FastClick(layer, options) {
		var oldOnClick;

		options = options || {};

		/**
		 * Whether a click is currently being tracked.
		 *
		 * @type boolean
		 */
		this.trackingClick = false;


		/**
		 * Timestamp for when click tracking started.
		 *
		 * @type number
		 */
		this.trackingClickStart = 0;


		/**
		 * The element being tracked for a click.
		 *
		 * @type EventTarget
		 */
		this.targetElement = null;


		/**
		 * X-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartX = 0;


		/**
		 * Y-coordinate of touch start event.
		 *
		 * @type number
		 */
		this.touchStartY = 0;


		/**
		 * ID of the last touch, retrieved from Touch.identifier.
		 *
		 * @type number
		 */
		this.lastTouchIdentifier = 0;


		/**
		 * Touchmove boundary, beyond which a click will be cancelled.
		 *
		 * @type number
		 */
		this.touchBoundary = options.touchBoundary || 10;


		/**
		 * The FastClick layer.
		 *
		 * @type Element
		 */
		this.layer = layer;

		/**
		 * The minimum time between tap(touchstart and touchend) events
		 *
		 * @type number
		 */
		this.tapDelay = options.tapDelay || 200;

		if (FastClick.notNeeded(layer)) {
			return;
		}

		// Some old versions of Android don't have Function.prototype.bind
		function bind(method, context) {
			return function() { return method.apply(context, arguments); };
		}


		var methods = ['onMouse', 'onClick', 'onTouchStart', 'onTouchMove', 'onTouchEnd', 'onTouchCancel'];
		var context = this;
		for (var i = 0, l = methods.length; i < l; i++) {
			context[methods[i]] = bind(context[methods[i]], context);
		}

		// Set up event handlers as required
		if (deviceIsAndroid) {
			layer.addEventListener('mouseover', this.onMouse, true);
			layer.addEventListener('mousedown', this.onMouse, true);
			layer.addEventListener('mouseup', this.onMouse, true);
		}

		layer.addEventListener('click', this.onClick, true);
		layer.addEventListener('touchstart', this.onTouchStart, false);
		layer.addEventListener('touchmove', this.onTouchMove, false);
		layer.addEventListener('touchend', this.onTouchEnd, false);
		layer.addEventListener('touchcancel', this.onTouchCancel, false);

		// Hack is required for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
		// which is how FastClick normally stops click events bubbling to callbacks registered on the FastClick
		// layer when they are cancelled.
		if (!Event.prototype.stopImmediatePropagation) {
			layer.removeEventListener = function(type, callback, capture) {
				var rmv = Node.prototype.removeEventListener;
				if (type === 'click') {
					rmv.call(layer, type, callback.hijacked || callback, capture);
				} else {
					rmv.call(layer, type, callback, capture);
				}
			};

			layer.addEventListener = function(type, callback, capture) {
				var adv = Node.prototype.addEventListener;
				if (type === 'click') {
					adv.call(layer, type, callback.hijacked || (callback.hijacked = function(event) {
						if (!event.propagationStopped) {
							callback(event);
						}
					}), capture);
				} else {
					adv.call(layer, type, callback, capture);
				}
			};
		}

		// If a handler is already declared in the element's onclick attribute, it will be fired before
		// FastClick's onClick handler. Fix this by pulling out the user-defined handler function and
		// adding it as listener.
		if (typeof layer.onclick === 'function') {

			// Android browser on at least 3.2 requires a new reference to the function in layer.onclick
			// - the old one won't work if passed to addEventListener directly.
			oldOnClick = layer.onclick;
			layer.addEventListener('click', function(event) {
				oldOnClick(event);
			}, false);
			layer.onclick = null;
		}
	}


	/**
	 * Android requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsAndroid = navigator.userAgent.indexOf('Android') > 0;


	/**
	 * iOS requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsIOS = /iP(ad|hone|od)/.test(navigator.userAgent);


	/**
	 * iOS 4 requires an exception for select elements.
	 *
	 * @type boolean
	 */
	var deviceIsIOS4 = deviceIsIOS && (/OS 4_\d(_\d)?/).test(navigator.userAgent);


	/**
	 * iOS 6.0(+?) requires the target element to be manually derived
	 *
	 * @type boolean
	 */
	var deviceIsIOSWithBadTarget = deviceIsIOS && (/OS ([6-9]|\d{2})_\d/).test(navigator.userAgent);

	/**
	 * BlackBerry requires exceptions.
	 *
	 * @type boolean
	 */
	var deviceIsBlackBerry10 = navigator.userAgent.indexOf('BB10') > 0;

	/**
	 * Determine whether a given element requires a native click.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element needs a native click
	 */
	FastClick.prototype.needsClick = function(target) {
		switch (target.nodeName.toLowerCase()) {

		// Don't send a synthetic click to disabled inputs (issue #62)
		case 'button':
		case 'select':
		case 'textarea':
			if (target.disabled) {
				return true;
			}

			break;
		case 'input':

			// File inputs need real clicks on iOS 6 due to a browser bug (issue #68)
			if ((deviceIsIOS && target.type === 'file') || target.disabled) {
				return true;
			}

			break;
		case 'label':
		case 'iframe': // iOS8 homescreen apps can prevent events bubbling into frames
		case 'video':
			return true;
		}

		return (/\bneedsclick\b/).test(target.className);
	};


	/**
	 * Determine whether a given element requires a call to focus to simulate click into element.
	 *
	 * @param {EventTarget|Element} target Target DOM element
	 * @returns {boolean} Returns true if the element requires a call to focus to simulate native click.
	 */
	FastClick.prototype.needsFocus = function(target) {
		switch (target.nodeName.toLowerCase()) {
		case 'textarea':
			return true;
		case 'select':
			return !deviceIsAndroid;
		case 'input':
			switch (target.type) {
			case 'button':
			case 'checkbox':
			case 'file':
			case 'image':
			case 'radio':
			case 'submit':
				return false;
			}

			// No point in attempting to focus disabled inputs
			return !target.disabled && !target.readOnly;
		default:
			return (/\bneedsfocus\b/).test(target.className);
		}
	};


	/**
	 * Send a click event to the specified element.
	 *
	 * @param {EventTarget|Element} targetElement
	 * @param {Event} event
	 */
	FastClick.prototype.sendClick = function(targetElement, event) {
		var clickEvent, touch;

		// On some Android devices activeElement needs to be blurred otherwise the synthetic click will have no effect (#24)
		if (document.activeElement && document.activeElement !== targetElement) {
			document.activeElement.blur();
		}

		touch = event.changedTouches[0];

		// Synthesise a click event, with an extra attribute so it can be tracked
		clickEvent = document.createEvent('MouseEvents');
		clickEvent.initMouseEvent(this.determineEventType(targetElement), true, true, window, 1, touch.screenX, touch.screenY, touch.clientX, touch.clientY, false, false, false, false, 0, null);
		clickEvent.forwardedTouchEvent = true;
		targetElement.dispatchEvent(clickEvent);
	};

	FastClick.prototype.determineEventType = function(targetElement) {

		//Issue #159: Android Chrome Select Box does not open with a synthetic click event
		if (deviceIsAndroid && targetElement.tagName.toLowerCase() === 'select') {
			return 'mousedown';
		}

		return 'click';
	};


	/**
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.focus = function(targetElement) {
		var length;

		// Issue #160: on iOS 7, some input elements (e.g. date datetime month) throw a vague TypeError on setSelectionRange. These elements don't have an integer value for the selectionStart and selectionEnd properties, but unfortunately that can't be used for detection because accessing the properties also throws a TypeError. Just check the type instead. Filed as Apple bug #15122724.
		if (deviceIsIOS && targetElement.setSelectionRange && targetElement.type.indexOf('date') !== 0 && targetElement.type !== 'time' && targetElement.type !== 'month') {
			length = targetElement.value.length;
			targetElement.setSelectionRange(length, length);
		} else {
			targetElement.focus();
		}
	};


	/**
	 * Check whether the given target element is a child of a scrollable layer and if so, set a flag on it.
	 *
	 * @param {EventTarget|Element} targetElement
	 */
	FastClick.prototype.updateScrollParent = function(targetElement) {
		var scrollParent, parentElement;

		scrollParent = targetElement.fastClickScrollParent;

		// Attempt to discover whether the target element is contained within a scrollable layer. Re-check if the
		// target element was moved to another parent.
		if (!scrollParent || !scrollParent.contains(targetElement)) {
			parentElement = targetElement;
			do {
				if (parentElement.scrollHeight > parentElement.offsetHeight) {
					scrollParent = parentElement;
					targetElement.fastClickScrollParent = parentElement;
					break;
				}

				parentElement = parentElement.parentElement;
			} while (parentElement);
		}

		// Always update the scroll top tracker if possible.
		if (scrollParent) {
			scrollParent.fastClickLastScrollTop = scrollParent.scrollTop;
		}
	};


	/**
	 * @param {EventTarget} targetElement
	 * @returns {Element|EventTarget}
	 */
	FastClick.prototype.getTargetElementFromEventTarget = function(eventTarget) {

		// On some older browsers (notably Safari on iOS 4.1 - see issue #56) the event target may be a text node.
		if (eventTarget.nodeType === Node.TEXT_NODE) {
			return eventTarget.parentNode;
		}

		return eventTarget;
	};


	/**
	 * On touch start, record the position and scroll offset.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchStart = function(event) {
		var targetElement, touch, selection;

		// Ignore multiple touches, otherwise pinch-to-zoom is prevented if both fingers are on the FastClick element (issue #111).
		if (event.targetTouches.length > 1) {
			return true;
		}

		targetElement = this.getTargetElementFromEventTarget(event.target);
		touch = event.targetTouches[0];

		if (deviceIsIOS) {

			// Only trusted events will deselect text on iOS (issue #49)
			selection = window.getSelection();
			if (selection.rangeCount && !selection.isCollapsed) {
				return true;
			}

			if (!deviceIsIOS4) {

				// Weird things happen on iOS when an alert or confirm dialog is opened from a click event callback (issue #23):
				// when the user next taps anywhere else on the page, new touchstart and touchend events are dispatched
				// with the same identifier as the touch event that previously triggered the click that triggered the alert.
				// Sadly, there is an issue on iOS 4 that causes some normal touch events to have the same identifier as an
				// immediately preceeding touch event (issue #52), so this fix is unavailable on that platform.
				// Issue 120: touch.identifier is 0 when Chrome dev tools 'Emulate touch events' is set with an iOS device UA string,
				// which causes all touch events to be ignored. As this block only applies to iOS, and iOS identifiers are always long,
				// random integers, it's safe to to continue if the identifier is 0 here.
				if (touch.identifier && touch.identifier === this.lastTouchIdentifier) {
					event.preventDefault();
					return false;
				}

				this.lastTouchIdentifier = touch.identifier;

				// If the target element is a child of a scrollable layer (using -webkit-overflow-scrolling: touch) and:
				// 1) the user does a fling scroll on the scrollable layer
				// 2) the user stops the fling scroll with another tap
				// then the event.target of the last 'touchend' event will be the element that was under the user's finger
				// when the fling scroll was started, causing FastClick to send a click event to that layer - unless a check
				// is made to ensure that a parent layer was not scrolled before sending a synthetic click (issue #42).
				this.updateScrollParent(targetElement);
			}
		}

		this.trackingClick = true;
		this.trackingClickStart = event.timeStamp;
		this.targetElement = targetElement;

		this.touchStartX = touch.pageX;
		this.touchStartY = touch.pageY;

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			event.preventDefault();
		}

		return true;
	};


	/**
	 * Based on a touchmove event object, check whether the touch has moved past a boundary since it started.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.touchHasMoved = function(event) {
		var touch = event.changedTouches[0], boundary = this.touchBoundary;

		if (Math.abs(touch.pageX - this.touchStartX) > boundary || Math.abs(touch.pageY - this.touchStartY) > boundary) {
			return true;
		}

		return false;
	};


	/**
	 * Update the last position.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchMove = function(event) {
		if (!this.trackingClick) {
			return true;
		}

		// If the touch has moved, cancel the click tracking
		if (this.targetElement !== this.getTargetElementFromEventTarget(event.target) || this.touchHasMoved(event)) {
			this.trackingClick = false;
			this.targetElement = null;
		}

		return true;
	};


	/**
	 * Attempt to find the labelled control for the given label element.
	 *
	 * @param {EventTarget|HTMLLabelElement} labelElement
	 * @returns {Element|null}
	 */
	FastClick.prototype.findControl = function(labelElement) {

		// Fast path for newer browsers supporting the HTML5 control attribute
		if (labelElement.control !== undefined) {
			return labelElement.control;
		}

		// All browsers under test that support touch events also support the HTML5 htmlFor attribute
		if (labelElement.htmlFor) {
			return document.getElementById(labelElement.htmlFor);
		}

		// If no for attribute exists, attempt to retrieve the first labellable descendant element
		// the list of which is defined here: http://www.w3.org/TR/html5/forms.html#category-label
		return labelElement.querySelector('button, input:not([type=hidden]), keygen, meter, output, progress, select, textarea');
	};


	/**
	 * On touch end, determine whether to send a click event at once.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onTouchEnd = function(event) {
		var forElement, trackingClickStart, targetTagName, scrollParent, touch, targetElement = this.targetElement;

		if (!this.trackingClick) {
			return true;
		}

		// Prevent phantom clicks on fast double-tap (issue #36)
		if ((event.timeStamp - this.lastClickTime) < this.tapDelay) {
			this.cancelNextClick = true;
			return true;
		}

		// Reset to prevent wrong click cancel on input (issue #156).
		this.cancelNextClick = false;

		this.lastClickTime = event.timeStamp;

		trackingClickStart = this.trackingClickStart;
		this.trackingClick = false;
		this.trackingClickStart = 0;

		// On some iOS devices, the targetElement supplied with the event is invalid if the layer
		// is performing a transition or scroll, and has to be re-detected manually. Note that
		// for this to function correctly, it must be called *after* the event target is checked!
		// See issue #57; also filed as rdar://13048589 .
		if (deviceIsIOSWithBadTarget) {
			touch = event.changedTouches[0];

			// In certain cases arguments of elementFromPoint can be negative, so prevent setting targetElement to null
			targetElement = document.elementFromPoint(touch.pageX - window.pageXOffset, touch.pageY - window.pageYOffset) || targetElement;
			targetElement.fastClickScrollParent = this.targetElement.fastClickScrollParent;
		}

		targetTagName = targetElement.tagName.toLowerCase();
		if (targetTagName === 'label') {
			forElement = this.findControl(targetElement);
			if (forElement) {
				this.focus(targetElement);
				if (deviceIsAndroid) {
					return false;
				}

				targetElement = forElement;
			}
		} else if (this.needsFocus(targetElement)) {

			// Case 1: If the touch started a while ago (best guess is 100ms based on tests for issue #36) then focus will be triggered anyway. Return early and unset the target element reference so that the subsequent click will be allowed through.
			// Case 2: Without this exception for input elements tapped when the document is contained in an iframe, then any inputted text won't be visible even though the value attribute is updated as the user types (issue #37).
			if ((event.timeStamp - trackingClickStart) > 100 || (deviceIsIOS && window.top !== window && targetTagName === 'input')) {
				this.targetElement = null;
				return false;
			}

			this.focus(targetElement);
			this.sendClick(targetElement, event);

			// Select elements need the event to go through on iOS 4, otherwise the selector menu won't open.
			// Also this breaks opening selects when VoiceOver is active on iOS6, iOS7 (and possibly others)
			if (!deviceIsIOS || targetTagName !== 'select') {
				this.targetElement = null;
				event.preventDefault();
			}

			return false;
		}

		if (deviceIsIOS && !deviceIsIOS4) {

			// Don't send a synthetic click event if the target element is contained within a parent layer that was scrolled
			// and this tap is being used to stop the scrolling (usually initiated by a fling - issue #42).
			scrollParent = targetElement.fastClickScrollParent;
			if (scrollParent && scrollParent.fastClickLastScrollTop !== scrollParent.scrollTop) {
				return true;
			}
		}

		// Prevent the actual click from going though - unless the target node is marked as requiring
		// real clicks or if it is in the whitelist in which case only non-programmatic clicks are permitted.
		if (!this.needsClick(targetElement)) {
			event.preventDefault();
			this.sendClick(targetElement, event);
		}

		return false;
	};


	/**
	 * On touch cancel, stop tracking the click.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.onTouchCancel = function() {
		this.trackingClick = false;
		this.targetElement = null;
	};


	/**
	 * Determine mouse events which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onMouse = function(event) {

		// If a target element was never set (because a touch event was never fired) allow the event
		if (!this.targetElement) {
			return true;
		}

		if (event.forwardedTouchEvent) {
			return true;
		}

		// Programmatically generated events targeting a specific element should be permitted
		if (!event.cancelable) {
			return true;
		}

		// Derive and check the target element to see whether the mouse event needs to be permitted;
		// unless explicitly enabled, prevent non-touch click events from triggering actions,
		// to prevent ghost/doubleclicks.
		if (!this.needsClick(this.targetElement) || this.cancelNextClick) {

			// Prevent any user-added listeners declared on FastClick element from being fired.
			if (event.stopImmediatePropagation) {
				event.stopImmediatePropagation();
			} else {

				// Part of the hack for browsers that don't support Event#stopImmediatePropagation (e.g. Android 2)
				event.propagationStopped = true;
			}

			// Cancel the event
			event.stopPropagation();
			event.preventDefault();

			return false;
		}

		// If the mouse event is permitted, return true for the action to go through.
		return true;
	};


	/**
	 * On actual clicks, determine whether this is a touch-generated click, a click action occurring
	 * naturally after a delay after a touch (which needs to be cancelled to avoid duplication), or
	 * an actual click which should be permitted.
	 *
	 * @param {Event} event
	 * @returns {boolean}
	 */
	FastClick.prototype.onClick = function(event) {
		var permitted;

		// It's possible for another FastClick-like library delivered with third-party code to fire a click event before FastClick does (issue #44). In that case, set the click-tracking flag back to false and return early. This will cause onTouchEnd to return early.
		if (this.trackingClick) {
			this.targetElement = null;
			this.trackingClick = false;
			return true;
		}

		// Very odd behaviour on iOS (issue #18): if a submit element is present inside a form and the user hits enter in the iOS simulator or clicks the Go button on the pop-up OS keyboard the a kind of 'fake' click event will be triggered with the submit-type input element as the target.
		if (event.target.type === 'submit' && event.detail === 0) {
			return true;
		}

		permitted = this.onMouse(event);

		// Only unset targetElement if the click is not permitted. This will ensure that the check for !targetElement in onMouse fails and the browser's click doesn't go through.
		if (!permitted) {
			this.targetElement = null;
		}

		// If clicks are permitted, return true for the action to go through.
		return permitted;
	};


	/**
	 * Remove all FastClick's event listeners.
	 *
	 * @returns {void}
	 */
	FastClick.prototype.destroy = function() {
		var layer = this.layer;

		if (deviceIsAndroid) {
			layer.removeEventListener('mouseover', this.onMouse, true);
			layer.removeEventListener('mousedown', this.onMouse, true);
			layer.removeEventListener('mouseup', this.onMouse, true);
		}

		layer.removeEventListener('click', this.onClick, true);
		layer.removeEventListener('touchstart', this.onTouchStart, false);
		layer.removeEventListener('touchmove', this.onTouchMove, false);
		layer.removeEventListener('touchend', this.onTouchEnd, false);
		layer.removeEventListener('touchcancel', this.onTouchCancel, false);
	};


	/**
	 * Check whether FastClick is needed.
	 *
	 * @param {Element} layer The layer to listen on
	 */
	FastClick.notNeeded = function(layer) {
		var metaViewport;
		var chromeVersion;
		var blackberryVersion;

		// Devices that don't support touch don't need FastClick
		if (typeof window.ontouchstart === 'undefined') {
			return true;
		}

		// Chrome version - zero for other browsers
		chromeVersion = +(/Chrome\/([0-9]+)/.exec(navigator.userAgent) || [,0])[1];

		if (chromeVersion) {

			if (deviceIsAndroid) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// Chrome on Android with user-scalable="no" doesn't need FastClick (issue #89)
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// Chrome 32 and above with width=device-width or less don't need FastClick
					if (chromeVersion > 31 && document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}

			// Chrome desktop doesn't need FastClick (issue #15)
			} else {
				return true;
			}
		}

		if (deviceIsBlackBerry10) {
			blackberryVersion = navigator.userAgent.match(/Version\/([0-9]*)\.([0-9]*)/);

			// BlackBerry 10.3+ does not require Fastclick library.
			// https://github.com/ftlabs/fastclick/issues/251
			if (blackberryVersion[1] >= 10 && blackberryVersion[2] >= 3) {
				metaViewport = document.querySelector('meta[name=viewport]');

				if (metaViewport) {
					// user-scalable=no eliminates click delay.
					if (metaViewport.content.indexOf('user-scalable=no') !== -1) {
						return true;
					}
					// width=device-width (or less than device-width) eliminates click delay.
					if (document.documentElement.scrollWidth <= window.outerWidth) {
						return true;
					}
				}
			}
		}

		// IE10 with -ms-touch-action: none, which disables double-tap-to-zoom (issue #97)
		if (layer.style.msTouchAction === 'none') {
			return true;
		}

		return false;
	};


	/**
	 * Factory method for creating a FastClick object
	 *
	 * @param {Element} layer The layer to listen on
	 * @param {Object} options The options to override the defaults
	 */
	FastClick.attach = function(layer, options) {
		return new FastClick(layer, options);
	};


	if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {

		// AMD. Register as an anonymous module.
		define(function() {
			return FastClick;
		});
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = FastClick.attach;
		module.exports.FastClick = FastClick;
	} else {
		window.FastClick = FastClick;
	}
}());

/**
 * XO - A lightweight MVC webapp framework inspired by Backbone
 */
(function($){
    if(!$) throw "Zepto or jQuery is required by XO!";
    
    //module define function
    window['XO'] = function(id,fn){
        if(XO[id]){
            console.warn('Module with id ['+id+'] exists!');
            return;
        };
        var mod = {id:id};
        //event interface for mod
        XO.EVENT[id]={};
        //inherit utils features
        $.extend(mod,_utils);
        //construct the module
        fn.call(mod,$,XO.CONST);
        XO[id] = mod;
        mod = null;
    };
    //extensions
    $.extend(XO,{
        $:$,
        version:'1.0.1',
        id:'XO',
        author:'XSin Studio',
        $doc:$(document),
        $body:$(document.body),
        $win:$(window),
        EVENT:{},//EVENT literary
        EVENT_NS:'_XO',//name
        Base:{},//Base namespace
        LS:localStorage,
        toHtml:function(tpl,obj,ext){
            tpl = XO.T.compile(tpl);
            return (tpl.render(obj,ext));
        },
        warn:function(txt,obj){
            txt = 'XO.JS:'+txt;
            if (window.console !== undefined && XO.App.opts.debug === true) {
                console.warn(txt,obj);
            }
            return txt;
        },
        isExternalLink:function($el){
            return ($el.attr('target') === '_blank' || $el.attr('rel') === 'external' || $el.is('a[href^="http://maps.google.com"], a[href^="mailto:"], a[href^="tel:"], a[href^="javascript:"], a[href*="youtube.com/v"], a[href*="youtube.com/watch"]'));
        }
    });

    //EVENT UTILS
    var _utils = {
        exposeEvent : function(name){
            if($.isArray(name)){
                for(var i=0,j=name.length;i<j;i++){
                    XO.EVENT[this.id][name[i]]='on'+this.id+name[i]+XO.EVENT_NS;
                }
                return;
            };
            XO.EVENT[this.id][name]='on'+this.id+name+XO.EVENT_NS;
        },
        disposeEvent : function(name){
            XO.$body.off(XO.EVENT[this.id][name]);
        },
        disposeAllEvents : function(){
            var evts = XO.EVENT[this.id];
            for(var c in evts){
                this.disposeEvent(c);
            };
        },
        getLSKey:function(privateKey){
            return ([XO.id,this.id,privateKey].join('.'));
        }
    };

})(window["Zepto"]||window["jQuery"]);

/**
 * XO utility methods,a enhanced lite version of underscore.js
 * @namespace XO._ 
 */
(function(exports){

    // Establish the object that gets returned to break out of a loop iteration.
    var breaker = {};

    // Save bytes in the minified (but not gzipped) version:
    var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

    // Create quick reference variables for speed access to core prototypes.
    var
        push             = ArrayProto.push,
        slice            = ArrayProto.slice,
        concat           = ArrayProto.concat,
        toString         = ObjProto.toString,
        hasOwnProperty   = ObjProto.hasOwnProperty;

    // All **ECMAScript 5** native function implementations that we hope to use
    // are declared here.
    var
        nativeForEach      = ArrayProto.forEach,
        nativeMap          = ArrayProto.map,
        nativeReduce       = ArrayProto.reduce,
        nativeReduceRight  = ArrayProto.reduceRight,
        nativeFilter       = ArrayProto.filter,
        nativeEvery        = ArrayProto.every,
        nativeSome         = ArrayProto.some,
        nativeIndexOf      = ArrayProto.indexOf,
        nativeLastIndexOf  = ArrayProto.lastIndexOf,
        nativeIsArray      = Array.isArray,
        nativeKeys         = Object.keys,
        nativeBind         = FuncProto.bind;

    var idCounter = 0,
        _={};
    
    _.uniqueId = function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
    };

    // Keep the identity function around for default iterators.
    _.identity = function(value) {
        return value;
    };

    // Collection Functions
    // --------------------
    // The cornerstone, an `each` implementation, aka `forEach`.
    // Handles objects with the built-in `forEach`, arrays, and raw objects.
    // Delegates to **ECMAScript 5**'s native `forEach` if available.
    var each = _.each = _.forEach = function(obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
            obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
            for (var i = 0, length = obj.length; i < length; i++) {
                if (iterator.call(context, obj[i], i, obj) === breaker) return;
            }
        } else {
            var keys = _.keys(obj);
            for (var i = 0, length = keys.length; i < length; i++) {
                if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
            }
        }
    };

    // Determine if at least one element in the object matches a truth test.
    // Delegates to **ECMAScript 5**'s native `some` if available.
    // Aliased as `any`.
    var any = _.some = _.any = function(obj, iterator, context) {
        iterator || (iterator = _.identity);
        var result = false;
        if (obj == null) return result;
        if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
        each(obj, function(value, index, list) {
            if (result || (result = iterator.call(context, value, index, list))) return breaker;
        });
        return !!result;
    };

    // Return the results of applying the iterator to each element.
    // Delegates to **ECMAScript 5**'s native `map` if available.
    _.map = _.collect = function(obj, iterator, context) {
        var results = [];
        if (obj == null) return results;
        if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
        each(obj, function(value, index, list) {
            results.push(iterator.call(context, value, index, list));
        });
        return results;
    };

    // If the value of the named `property` is a function then invoke it with the
    // `object` as context; otherwise, return it.
    _.result = function(object, property) {
        if (object == null) return void 0;
        var value = object[property];
        return _.isFunction(value) ? value.call(object) : value;
    };

    // Extend a given object with all the properties in passed-in object(s).
    _.extend = function(obj) {
        each(slice.call(arguments, 1), function(source) {
            if (source) {
                for (var prop in source) {
                    obj[prop] = source[prop];
                }
            }
        });
        return obj;
    };

    // Set up the prototype chain for subclasses.
    // Similar to `goog.inherits`, but uses a hash of prototype properties and
    // class properties to be extended.
    _.derive = function(protoProps, staticProps) {
        var parent = this;
        var child;

        // The constructor function for the new subclass is either defined by you
        // (the "constructor" property in your `extend` definition), or defaulted
        // by us to simply call the parent's constructor.
        if (protoProps && _.has(protoProps, 'constructor')) {
            child = protoProps.constructor;
        } else {
            child = function(){ return parent.apply(this, arguments); };
        }

        // Add static properties to the constructor function, if supplied.
        _.extend(child, parent, staticProps);

        // Set the prototype chain to inherit from `parent`, without calling
        // `parent`'s constructor function.
        var Surrogate = function(){ this.constructor = child; };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate;

        // Add prototype properties (instance properties) to the subclass,
        // if supplied.
        if (protoProps) _.extend(child.prototype, protoProps);

        // Set a convenience property in case the parent's prototype is needed
        // later.
        child.__super__ = parent.prototype;

        return child;
    };

    // Is a given array, string, or object empty?
    // An "empty" object has no enumerable own-properties.
    _.isEmpty = function(obj) {
        if (obj == null) return true;
        if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
        for (var key in obj) if (_.has(obj, key)) return false;
        return true;
    };

    // Is a given value an array?
    // Delegates to ECMA5's native Array.isArray
    _.isArray = nativeIsArray || function(obj) {
        return toString.call(obj) == '[object Array]';
    };

    // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
    each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
        _['is' + name] = function(obj) {
            return toString.call(obj) == '[object ' + name + ']';
        };
    });

    // Optimize `isFunction` if appropriate.
    if (typeof (/./) !== 'function') {
        _.isFunction = function(obj) {
            return typeof obj === 'function';
        };
    }

    // Return a copy of the object only containing the whitelisted properties.
    _.pick = function(obj) {
        var copy = {};
        var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
        each(keys, function(key) {
          if (key in obj) copy[key] = obj[key];
        });
        return copy;
    };

    // Shortcut function for checking if an object has a given property directly
    // on itself (in other words, not on a prototype).
    _.has = function(obj, key) {
        return hasOwnProperty.call(obj, key);
    };

    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    _.once = function(func) {
        var ran = false, memo;
        return function() {
            if (ran) return memo;
            ran = true;
            memo = func.apply(this, arguments);
            func = null;
            return memo;
        };
    };

    // Object Functions
    // ----------------

    // Retrieve the names of an object's properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`
    _.keys = nativeKeys || function(obj) {
        if (obj !== Object(obj)) throw new TypeError('Invalid object');
        var keys = [];
        for (var key in obj) if (_.has(obj, key)) keys.push(key);
        return keys;
    };

    // Function (ahem) Functions
    // ------------------

    // Reusable constructor function for prototype setting.
    var ctor = function(){};

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
    // available.
    _.bind = function(func, context) {
        var args, bound;
        if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
        if (!_.isFunction(func)) throw new TypeError;
        args = slice.call(arguments, 2);
        return bound = function() {
            if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
            ctor.prototype = func.prototype;
            var _self = new ctor;
            ctor.prototype = null;
            var result = func.apply(_self, args.concat(slice.call(arguments)));
            if (Object(result) === result) return result;
            return _self;
        };
    };

    // Bind all of an object's methods to that object. Useful for ensuring that
    // all callbacks defined on an object belong to it.
    _.bindAll = function(obj) {
        var funcs = slice.call(arguments, 1);
        if (funcs.length === 0) throw new Error("bindAll must be passed function names");
        each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
        return obj;
    };

    exports._ = _;

})(XO);
/**
 * A module that can be mixed in to *any object* in order to provide it with
 * custom events. You may bind with `on` or remove with `off` callback
 * functions to an event; `trigger`-ing an event fires all callbacks in
 * succession.
 *
 *     var object = {};
 *     _.extend(object, XO.Base.Events);
 *     object.on('expand', function(){ alert('expanded'); });
 *     object.trigger('expand');
 *
 * @namespace XO.Base.Events
 * @dependence XO._
 */
(function(exports,_){

    var Events = {

        // Bind an event to a `callback` function. Passing `"all"` will bind
        // the callback to all events fired.
        on: function(name, callback, context) {
            if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
            this._events || (this._events = {});
            var events = this._events[name] || (this._events[name] = []);
            events.push({callback: callback, context: context, ctx: context || this});
            return this;
        },

        // Bind an event to only be triggered a single time. After the first time
        // the callback is invoked, it will be removed.
        once: function(name, callback, context) {
            if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
            var _self = this;
            var once = _.once(function() {
                _self.off(name, once);
                callback.apply(this, arguments);
            });
            once._callback = callback;
            return this.on(name, once, context);
        },

        // Remove one or many callbacks. If `context` is null, removes all
        // callbacks with that function. If `callback` is null, removes all
        // callbacks for the event. If `name` is null, removes all bound
        // callbacks for all events.
        off: function(name, callback, context) {
            var retain, ev, events, names, i, l, j, k;
            if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
            if (!name && !callback && !context) {
                this._events = {};
                return this;
            }
            names = name ? [name] : _.keys(this._events);
            for (i = 0, l = names.length; i < l; i++) {
                name = names[i];
                if (events = this._events[name]) {
                    this._events[name] = retain = [];
                    if (callback || context) {
                        for (j = 0, k = events.length; j < k; j++) {
                            ev = events[j];
                            if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                                (context && context !== ev.context)) {
                                retain.push(ev);
                            }//if
                        }//for
                    }//if
                    if (!retain.length) delete this._events[name];
               }//if
            }//for
            return this;
        },

        // Trigger one or many events, firing all bound callbacks. Callbacks are
        // passed the same arguments as `trigger` is, apart from the event name
        // (unless you're listening on `"all"`, which will cause your callback to
        // receive the true name of the event as the first argument).
        trigger: function(name) {
            if (!this._events) return this;
            var args = Array.prototype.slice.call(arguments, 1);
            if (!eventsApi(this, 'trigger', name, args)) return this;
            var events = this._events[name];
            var allEvents = this._events.all;
            if (events) triggerEvents(events, args);
            if (allEvents) triggerEvents(allEvents, arguments);
            return this;
        },

        // Tell this object to stop listening to either specific events ... or
        // to every object it's currently listening to.
        stopListening: function(obj, name, callback) {
            var listeningTo = this._listeningTo;
            if (!listeningTo) return this;
            var remove = !name && !callback;
            if (!callback && typeof name === 'object') callback = this;
            if (obj) (listeningTo = {})[obj._listenId] = obj;
            for (var id in listeningTo) {
                obj = listeningTo[id];
                obj.off(name, callback, this);
                if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
            }
            return this;
        }
    };

    // Regular expression used to split event strings.
    var eventSplitter = /\s+/;

    // Implement fancy features of the Events API such as multiple event
    // names `"change blur"` and jQuery-style event maps `{change: action}`
    // in terms of the existing API.
    var eventsApi = function(obj, action, name, rest) {
        if (!name) return true;

        // Handle event maps.
        if (typeof name === 'object') {
            for (var key in name) {
                obj[action].apply(obj, [key, name[key]].concat(rest));
            }
            return false;
        }

        // Handle space separated event names.
        if (eventSplitter.test(name)) {
            var names = name.split(eventSplitter);
            for (var i = 0, l = names.length; i < l; i++) {
                obj[action].apply(obj, [names[i]].concat(rest));
            }
            return false;
        }

        return true;
    };

    // A difficult-to-believe, but optimized internal dispatch function for
    // triggering events. Tries to keep the usual cases speedy (most internal
    // Backbone events have 3 arguments).
    var triggerEvents = function(events, args) {
        var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
        switch (args.length) {
            case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
            case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
            case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
            case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
            default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
        }
    };

    var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

    // Inversion-of-control versions of `on` and `once`. Tell *this* object to
    // listen to an event in another object ... keeping track of what it's
    // listening to.
    _.each(listenMethods, function(implementation, method) {
        Events[method] = function(obj, name, callback) {
            var listeningTo = this._listeningTo || (this._listeningTo = {});
            var id = obj._listenId || (obj._listenId = _.uniqueId('evtListen'));
            listeningTo[id] = obj;
            if (!callback && typeof name === 'object') callback = this;
            obj[implementation](name, callback, this);
            return this;
        };
    });
    
    exports.Events = Events;

})(XO.Base,XO._);
/**
 * XO.Base.History
 * ----------------
 *
 * Handles cross-browser history management, based on either
 * [pushState](http://diveintohtml5.info/history.html) and real URLs, or
 * [onhashchange](https://developer.mozilla.org/en-US/docs/DOM/window.onhashchange)
 * and URL fragments. If the browser supports neither (old IE, natch),
 * falls back to polling.

 * @namespace XO.Base
 * @dependencies XO._, XO.Base.Events
 */
(function(exports,_){


    var History = function() {
        this.handlers = [];
        _.bindAll(this, 'checkUrl');

        // Ensure that `History` can be used outside of the browser.
        if (typeof window !== 'undefined') {
            this.location = window.location;
            this.history = window.history;
        }
    };
    var $win = XO.$win;
    // Cached regex for stripping a leading hash/slash and trailing space.
    var routeStripper = /^[#\/]|\s+$/g;

    // Cached regex for stripping leading and trailing slashes.
    var rootStripper = /^\/+|\/+$/g;

    // Cached regex for detecting MSIE.
    var isExplorer = /msie [\w.]+/;

    // Cached regex for removing a trailing slash.
    var trailingSlash = /\/$/;

    // Cached regex for stripping urls of hash and query.
    var pathStripper = /[?#].*$/;

    // Has the history handling already been started?
    History.started = false;

    // Set up all inheritable **XO.Base.History** properties and methods.
    _.extend(History.prototype, XO.Base.Events, {

        // The default interval to poll for hash changes, if necessary, is
        // twenty times a second.
        interval: 50,

        // Gets the true hash value. Cannot use location.hash directly due to bug
        // in Firefox where location.hash will always be decoded.
        getHash: function(window) {
            var match = (window || this).location.href.match(/#(.*)$/);
            return match ? match[1] : '';
        },

        // Get the cross-browser normalized URL fragment, either from the URL,
        // the hash, or the override.
        getFragment: function(fragment, forcePushState) {
            if (fragment == null) {
                if (this._hasPushState || !this._wantsHashChange || forcePushState) {
                    fragment = this.location.pathname;
                    var root = this.root.replace(trailingSlash, '');
                    if (!fragment.indexOf(root)) fragment = fragment.slice(root.length);
                } else {
                    fragment = this.getHash();
                }
            }
            return fragment.replace(routeStripper, '');
        },

        // Start the hash change handling, returning `true` if the current URL matches
        // an existing route, and `false` otherwise.
        start: function(options) {
            if (History.started) throw new Error("XO.Base.History has already been started");
            History.started = true;

            // Figure out the initial configuration. Do we need an iframe?
            // Is pushState desired ... is it available?
            this.options          = _.extend({root: '/'}, this.options, options);
            this.root             = this.options.root;
            this._wantsHashChange = this.options.hashChange !== false;
            this._wantsPushState  = !!this.options.pushState;
            this._hasPushState    = !!(this.options.pushState && this.history && this.history.pushState);
            var fragment          = this.getFragment();
            var docMode           = document.documentMode;
            var oldIE             = (isExplorer.exec(navigator.userAgent.toLowerCase()) && (!docMode || docMode <= 7));

            // Normalize root to always include a leading and trailing slash.
            this.root = ('/' + this.root + '/').replace(rootStripper, '/');

            if (oldIE && this._wantsHashChange) {
                this.iframe = XO.$('<iframe id="if_XOHistoryHack" src="javascript:0" tabindex="-1" />').hide().appendTo('body')[0].contentWindow;
                this.navigate(fragment);
            }

            // Depending on whether we're using pushState or hashes, and whether
            // 'onhashchange' is supported, determine how we check the URL state.
            if (this._hasPushState) {
                $win.on('popstate', this.checkUrl);
            } else if (this._wantsHashChange && ('onhashchange' in window) && !oldIE) {
                $win.on('hashchange', this.checkUrl);
            } else if (this._wantsHashChange) {
                this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
            }

            // Determine if we need to change the base url, for a pushState link
            // opened by a non-pushState browser.
            this.fragment = fragment;
            var loc = this.location;
            var atRoot = loc.pathname.replace(/[^\/]$/, '$&/') === this.root;

            // Transition from hashChange to pushState or vice versa if both are
            // requested.
            if (this._wantsHashChange && this._wantsPushState) {

                // If we've started off with a route from a `pushState`-enabled
                // browser, but we're currently in a browser that doesn't support it...
                if (!this._hasPushState && !atRoot) {
                    this.fragment = this.getFragment(null, true);
                    this.location.replace(this.root + this.location.search + '#' + this.fragment);
                    // Return immediately as browser will do redirect to new url
                    return true;

                    // Or if we've started out with a hash-based route, but we're currently
                    // in a browser where it could be `pushState`-based instead...
                } else if (this._hasPushState && atRoot && loc.hash) {
                    this.fragment = this.getHash().replace(routeStripper, '');
                    this.history.replaceState({}, document.title, this.root + this.fragment + loc.search);
                }

            }//if

            if (!this.options.silent) return this.loadUrl();
        },

        // Disable XO.Base.history, perhaps temporarily. Not useful in a real app,
        // but possibly useful for unit testing Routers.
        stop: function() {
            $win.off('popstate', this.checkUrl).off('hashchange', this.checkUrl);
            clearInterval(this._checkUrlInterval);
            History.started = false;
        },

        // Add a route to be tested when the fragment changes. Routes added later
        // may override previous routes.
        route: function(route, callback) {
            this.handlers.unshift({route: route, callback: callback});
        },

        // Checks the current URL to see if it has changed, and if it has,
        // calls `loadUrl`, normalizing across the hidden iframe.
        checkUrl: function(e) {
            var current = this.getFragment();
            if (current === this.fragment && this.iframe) {
                current = this.getFragment(this.getHash(this.iframe));
            }
            if (current === this.fragment) return false;
            if (this.iframe) this.navigate(current);
            this.loadUrl();
        },

        // Attempt to load the current URL fragment. If a route succeeds with a
        // match, returns `true`. If no defined routes matches the fragment,
        // returns `false`.
        loadUrl: function(fragment) {
            fragment = this.fragment = this.getFragment(fragment);
            return _.any(this.handlers, function(handler) {
                if (handler.route.test(fragment)) {
                    handler.callback(fragment);
                    return true;
                }//if
            });
        },

        // Save a fragment into the hash history, or replace the URL state if the
        // 'replace' option is passed. You are responsible for properly URL-encoding
        // the fragment in advance.
        //
        // The options object can contain `trigger: true` if you wish to have the
        // route callback be fired (not usually desirable), or `replace: true`, if
        // you wish to modify the current URL without adding an entry to the history.
        navigate: function(fragment, options) {
            if (!History.started) return false;
            if (!options || options === true) options = {trigger: !!options};

            var url = this.root + (fragment = this.getFragment(fragment || ''));

            // Strip the fragment of the query and hash for matching.
            fragment = fragment.replace(pathStripper, '');

            if (this.fragment === fragment) return;
            this.fragment = fragment;

            // Don't include a trailing slash on the root.
            if (fragment === '' && url !== '/') url = url.slice(0, -1);

            // If pushState is available, we use it to set the fragment as a real URL.
            if (this._hasPushState) {
                this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

                // If hash changes haven't been explicitly disabled, update the hash
                // fragment to store history.
            } else if (this._wantsHashChange) {
                this._updateHash(this.location, fragment, options.replace);
                if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
                    // Opening and closing the iframe tricks IE7 and earlier to push a
                    // history entry on hash-tag change.  When replace is true, we don't
                    // want this.
                    if(!options.replace) this.iframe.document.open().close();
                    this._updateHash(this.iframe.location, fragment, options.replace);
                }

                // If you've told us that you explicitly don't want fallback hashchange-
                // based history, then `navigate` becomes a page refresh.
            } else {
                return this.location.assign(url);
            }
            if (options.trigger) return this.loadUrl(fragment);
        },

        // Update the hash location, either replacing the current entry, or adding
        // a new one to the browser history.
        _updateHash: function(location, fragment, replace) {
            if (replace) {
                var href = location.href.replace(/(javascript:|#).*$/, '');
                location.replace(href + '#' + fragment);
            } else {
                // Some browsers require that `hash` contains a leading #.
                location.hash = '#' + fragment;
            }
        }

    });

    // Set up inheritance for History
    History.extend = _.derive;
    exports.History = History;
    exports.history = new History;

})(XO.Base,XO._);
/**
 * XO.Base.Router, referring to Backbone.Router
 * ---------------
 * Routers map faux-URLs to actions, and fire events when routes are
 * matched. Creating a new one sets its `routes` hash, if not set statically.
 * @namespace XO.Base
 * @dependence XO._, XO.Base.Events, XO.Base.history
 */
(function(exports,_){


    var Router = function(options) {
        options || (options = {});
        if (options.routes) this.routes = options.routes;
        this._bindRoutes();
        this.initialize.apply(this, arguments);
    };

    // Cached regular expressions for matching named param parts and splatted
    // parts of route strings.
    var optionalParam = /\((.*?)\)/g;
    var namedParam    = /(\(\?)?:\w+/g;
    var splatParam    = /\*\w+/g;
    var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#\s]/g;

    // Set up all inheritable **XO.Base.Router** properties and methods.
    _.extend(Router.prototype, XO.Base.Events, {

        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function(){},

        // Manually bind a single named route to a callback. For example:
        //
        //     this.route('search/:query/p:num', 'search', function(query, num) {
        //       ...
        //     });
        //
        route: function(route, name, callback) {
            if (!_.isRegExp(route)) route = this._routeToRegExp(route);
            if (_.isFunction(name)) {
                callback = name;
                name = '';
            }
            if (!callback) callback = this[name];
            var router = this;
            XO.Base.history.route(route, function(fragment) {
                var args = router._extractParameters(route, fragment);
                callback && callback.apply(router, args);
                router.trigger.apply(router, ['route:' + name].concat(args));
                router.trigger('route', name, args);
                XO.Base.history.trigger('route', router, name, args);
            });
            return this;
        },

        // Simple proxy to `XO.Base.History` to save a fragment into the history.
        navigate: function(fragment, options) {
            XO.Base.history.navigate(fragment, options);
            return this;
        },

        // Bind all defined routes to `XO.Base.History`. We have to reverse the
        // order of the routes here to support behavior where the most general
        // routes can be defined at the bottom of the route map.
        _bindRoutes: function() {
            if (!this.routes) return;
            this.routes = _.result(this, 'routes');
            var route, routes = _.keys(this.routes);
            while ((route = routes.pop()) != null) {
                this.route(route, this.routes[route]);
            }
        },

        // Convert a route string into a regular expression, suitable for matching
        // against the current location hash.
        _routeToRegExp: function(route) {
            route = route.replace(escapeRegExp, '\\$&')
                .replace(optionalParam, '(?:$1)?')
                .replace(namedParam, function(match, optional) {
                    return optional ? match : '([^\/]+)';
                })
                .replace(splatParam, '(.*?)');
            return new RegExp('^' + route + '$');
        },

        // Given a route, and a URL fragment that it matches, return the array of
        // extracted decoded parameters. Empty or unmatched parameters will be
        // treated as `null` to normalize cross-browser behavior.
        _extractParameters: function(route, fragment) {
            var params = route.exec(fragment).slice(1);
            return _.map(params, function(param) {
                return param ? decodeURIComponent(param) : null;
            });
        }

    });

    // Set up inheritance for view
    Router.extend = _.derive;

    exports.Router = Router;


})(XO.Base,XO._);
/**
 * View, referring and thanks to Backbound.View
 * -------------
 * XO Views are almost more convention than they are actual code. A View
 * is simply a JavaScript object that represents a logical chunk of UI in the
 * DOM. This might be a single item, an entire list, a sidebar or panel, or
 * even the surrounding frame which wraps your whole app. Defining a chunk of
 * UI as a **View** allows you to define your DOM events declaratively, without
 * having to worry about render order ... and makes it easy for the view to
 * react to specific changes in the state of your models.

 * Creating a XO.Base.View creates its initial element outside of the DOM,
 * if an existing element is not provided...
 *
 * @namespace XO.Base
 * @dependences XO._, XO.Base.Events
 */
(function(exports,_){

    var View = function(options) {
        this.cid = _.uniqueId('view');
        options || (options = {});
        _.extend(this, _.pick(options, viewOptions));
        this._ensureElement();
        this.initialize.apply(this, arguments);
        this.delegateEvents();
    };

    // Cached regex to split keys for `delegate`.
    var delegateEventSplitter = /^(\S+)\s*(.*)$/;

    // List of view options to be merged as properties.
    var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

    // Set up all inheritable **XO.Base.View** properties and methods.
    _.extend(View.prototype, XO.Base.Events, {

        // The default `tagName` of a View's element is `"div"`.
        tagName: 'div',

        // jQuery delegate for element lookup, scoped to DOM elements within the
        // current view. This should be preferred to global lookups where possible.
        $: function(selector) {
            return this.$el.find(selector);
        },

        // Initialize is an empty function by default. Override it with your own
        // initialization logic.
        initialize: function(){},

        // **render** is the core function that your view should override, in order
        // to populate its element (`this.el`), with the appropriate HTML. The
        // convention is for **render** to always return `this`.
        render: function() {
            return this;
        },

        // Remove this view by taking the element out of the DOM, and removing any
        // applicable Backbone.Events listeners.
        remove: function() {
            this.$el.remove();
            this.stopListening();
            return this;
        },

        // Change the view's element (`this.el` property), including event
        // re-delegation.
        setElement: function(element, delegate) {
            if (this.$el) this.undelegateEvents();
            this.$el = element instanceof XO.$ ? element : XO.$(element);
            this.el = this.$el[0];
            if (delegate !== false) this.delegateEvents();
            return this;
        },

        // Set callbacks, where `this.events` is a hash of
        //
        // *{"event selector": "callback"}*
        //
        //     {
        //       'mousedown .title':  'edit',
        //       'click .button':     'save',
        //       'click .open':       function(e) { ... }
        //     }
        //
        // pairs. Callbacks will be bound to the view, with `this` set properly.
        // Uses event delegation for efficiency.
        // Omitting the selector binds the event to `this.el`.
        // This only works for delegate-able events: not `focus`, `blur`, and
        // not `change`, `submit`, and `reset` in Internet Explorer.
        delegateEvents: function(events) {
            if (!(events || (events = _.result(this, 'events')))) return this;
            this.undelegateEvents();
            for (var key in events) {
                var method = events[key];
                if (!_.isFunction(method)) method = this[events[key]];
                if (!method) continue;

                var match = key.match(delegateEventSplitter);
                var eventName = match[1], selector = match[2];
                method = _.bind(method, this);
                eventName += '.delegateEvents' + this.cid;
                if (selector === '') {
                    this.$el.on(eventName, method);
                } else {
                    this.$el.on(eventName, selector, method);
                }
            }//for
            return this;
        },

        // Clears all callbacks previously bound to the view with `delegateEvents`.
        // You usually don't need to use this, but may wish to if you have multiple
        // XO views attached to the same DOM element.
        undelegateEvents: function() {
          this.$el.off('.delegateEvents' + this.cid);
          return this;
        },

        // Ensure that the View has a DOM element to render into.
        // If `this.el` is a string, pass it through `$()`, take the first
        // matching element, and re-assign it to `el`. Otherwise, create
        // an element from the `id`, `className` and `tagName` properties.
        _ensureElement: function() {
            if (!this.el) {
              var attrs = _.extend({}, _.result(this, 'attributes'));
              if (this.id) attrs.id = _.result(this, 'id');
              if (this.className) attrs['class'] = _.result(this, 'className');
              var $el = XO.$('<' + _.result(this, 'tagName') + '>').attr(attrs);
              this.setElement($el, false);
            } else {
              this.setElement(_.result(this, 'el'), false);
            }
        }

    });

    // Set up inheritance for view
    View.extend = _.derive;

    exports.View = View;

})(XO.Base,XO._);

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
// requestAnimationFrame polyfill by Erik Möller. fixes from Paul Irish and Tino Zijdel
// Ref:https://gist.github.com/mamboer/8179563
(function(W) {
    var lastTime = 0,
        vendors = ['ms', 'moz', 'webkit', 'o'],
        x,
        length,
        currTime,
        timeToCall,
        requestAnimFrame0 = W['requestAnimationFrame'],
        cancelAnimFrame0 = W['cancelAnimationFrame'];
 
    for(x = 0, length = vendors.length; x < length && !requestAnimFrame0; ++x) {
        requestAnimFrame0 = W[vendors[x]+'RequestAnimationFrame'];
        cancelAnimFrame0 = 
          W[vendors[x]+'CancelAnimationFrame'] || W[vendors[x]+'CancelRequestAnimationFrame'];
    }
 
    if (!requestAnimFrame0){
        W.requestAnimationFrame = function(callback, element) {
            currTime = new Date().getTime();
            timeToCall = Math.max(0, 16 - (currTime - lastTime));
            lastTime = currTime + timeToCall;
            return W.setTimeout(function() { callback(currTime + timeToCall); }, 
              timeToCall);
        };
    } else {
        W.requestAnimationFrame = requestAnimFrame0;
    }
 
    if (!cancelAnimFrame0){
        W.cancelAnimationFrame = function(id) {
            W.clearTimeout(id);
        };
    } else {
        W.cancelAnimationFrame = cancelAnimFrame0;
    }

    /**
     * Behaves the same as setTimeout except uses requestAnimationFrame() where possible for better performance
     * @param {function} fn The callback function
     * @param {int} delay The delay in milliseconds
     */
    W.requestTimeout = function(fn, delay) {
        if( !requestAnimFrame0)
                return W.setTimeout(fn, delay);
                
        var start = new Date().getTime(),
            handle = new Object();
            
        function loop(){
            var current = new Date().getTime(),
                delta = current - start;
                
            delta >= delay ? fn.call() : handle.value = requestAnimFrame0(loop);
        };
        
        handle.value = requestAnimFrame0(loop);
        return handle;
    };
     
    /**
     * Behaves the same as clearTimeout except uses cancelRequestAnimationFrame() where possible for better performance
     * @param {int|object} fn The callback function
     */
    W.clearRequestTimeout = function(handle) {
        cancelAnimFrame0?cancelAnimFrame0(handle.value):W.clearTimeout(handle);
    };

    /**
     * Behaves the same as setInterval except uses requestAnimationFrame() where possible for better performance
     * @param {function} fn The callback function
     * @param {int} delay The delay in milliseconds
     */
    W.requestInterval = function(fn, delay) {
        if( !requestAnimFrame0 )
                return W.setInterval(fn, delay);
                
        var start = new Date().getTime(),
            handle = new Object();
            
        function loop() {
            var current = new Date().getTime(),
                delta = current - start;
                
            if(delta >= delay) {
                fn.call();
                start = new Date().getTime();
            }
     
            handle.value = requestAnimFrame0(loop);
        };
        
        handle.value = requestAnimFrame0(loop);
        return handle;
    }
     
    /**
     * Behaves the same as clearInterval except uses cancelRequestAnimationFrame() where possible for better performance
     * @param {int|object} fn The callback function
     */
    W.clearRequestInterval = function(handle) {
        cancelAnimFrame0?cancelAnimFrame0(handle.value):W.clearInterval(handle);
    };

})(window);

XO.CONST = {
    CLASS:{
        ACTIVE:'current',
        UIACTIVE:'active',
        ANIMATION_IN:'in',
        ANIMATION_OUT:'out',
        ANIMATION_INMOTION:'inmotion',
        SUPPORT_3D:'supports3d',
        IOS5_AND_ABOVE:'ios5up',
        SUPPORT_TOUCHSCROLL:'touchscroll',
        SUPPORT_AUTOSCROLL:'autoscroll',
        ANIMATION_3D:'animating3d',
        ANIMATING:'animating',
        HIDE:'hide'
    },
    SELECTOR:{
        PAGE_WRAPPER:'body',
        DEFAULT_CSS_HOST:'body'
    },
    ATTR:{
        PAGE:'data-page',
        PAGE_SRC:'data-pagesrc',
        ANIMATION:'data-animate'
    },
    DEFAULT:{
        ANIMATION_NONE:'none',
        TEMPLATE_SUFFIX:'/',
        VIEW:'index',
        PAGE:'home',
        VIEW_ID_PREFIX:'xoview',
        DEFAULT_ACTION_PREFIX:'_'
    },
    ACTION:{
        PAGE:'page',
        SECTION:'section'
    }
};
XO('media',function($,C){

    /*! matchMedia() polyfill - Test a CSS media type/query in JS. Authors & copyright (c) 2012: Scott Jehl, Paul Irish, Nicholas Zakas. Dual MIT/BSD license */
    window.matchMedia = window.matchMedia || (function( doc, undefined ) {

        "use strict";

        var bool,
            docElem = doc.documentElement,
            refNode = docElem.firstElementChild || docElem.firstChild,
            // fakeBody required for <FF4 when executed in <head>
            fakeBody = doc.createElement( "body" ),
            div = doc.createElement( "div" );

        div.id = "mq-test-1";
        div.style.cssText = "position:absolute;top:-100em";
        fakeBody.style.background = "none";
        fakeBody.appendChild(div);

        return function(q){

            div.innerHTML = "&shy;<style media=\"" + q + "\"> #mq-test-1 { width: 42px; }</style>";

            docElem.insertBefore( fakeBody, refNode );
            bool = div.offsetWidth === 42;
            docElem.removeChild( fakeBody );

            return {
                matches: bool,
                media: q
            };

        };

    }( document ));

    // $.mobile.media uses matchMedia to return a boolean.
    this.test = function( q ) {
        return window.matchMedia( q ).matches;
    };

});
XO('support',function($,C){

    var helpers = {

        supportForTransform3d : function() {

            var mqProp = "transform-3d",
                vendors = [ "Webkit", "Moz", "O" ],
                fakeBody = $( "<body id='XO-3DTEST'>" ).prependTo( "html" ),
                // Because the `translate3d` test below throws false positives in Android:
                ret = XO.media.test( "(-" + vendors.join( "-" + mqProp + "),(-" ) + "-" + mqProp + "),(" + mqProp + ")" ),
                el, transforms, t;

            if ( ret ) {
                return !!ret;
            }

            el = document.createElement( "div" );
            transforms = {
                // We’re omitting Opera for the time being; MS uses unprefixed.
                "MozTransform": "-moz-transform",
                "transform": "transform"
            };

            fakeBody.append( el );

            for ( t in transforms ) {
                if ( el.style[ t ] !== undefined ) {
                    el.style[ t ] = "translate3d( 100px, 1px, 1px )";
                    ret = window.getComputedStyle( el ).getPropertyValue( transforms[ t ] );
                }
            }
            fakeBody.parentNode.removeChild(fakeBody);
            return ( !!ret && ret !== "none" );
        },
        supportIOS5 : function() {
            var support = false,
                REGEX_IOS_VERSION = /OS (\d+)(_\d+)* like Mac OS X/i,
                agentString = window.navigator.userAgent;
            if (REGEX_IOS_VERSION.test(agentString)) {
                support = (REGEX_IOS_VERSION.exec(agentString)[1] >= 5);
            }
            return support;
        }
    };

    this.init = function(opts){
        this.animationEvents = (typeof window.WebKitAnimationEvent !== 'undefined');
        this.touch = (typeof window.TouchEvent !== 'undefined') && (window.navigator.userAgent.indexOf('Mobile') > -1) && XO.App.opts.useFastTouch;
        this.transform3d = helpers.supportForTransform3d();
        this.ios5 = helpers.supportIOS5();

        if (!this.touch) {
            XO.warn('This device does not support touch interaction, or it has been deactivated by the developer. Some features might be unavailable.');
        }
        if (!this.transform3d) {
            XO.warn('This device does not support 3d animation. 2d animations will be used instead.');
        }

        var featuresClass=[];
        this.transform3d && XO.App.opts.useTransform3D && featuresClass.push(C.CLASS.SUPPORT_3D);
        if(opts.useTouchScroll){
            if(this.ios5){
                featuresClass.push(C.CLASS.TOUCHSCROLL);
            }else{
                featuresClass.push(C.CLASS.AUTOSCROLL);
            }
        }

        XO.$body.addClass(featuresClass.join(' '));

    }

});
XO('Event',function($){
    this.on= function(fullName,handler){
        if(arguments.length<=2){
            XO.$body.on(fullName,handler);
            return;
        }
        $(arguments[0]).on(arguments[1],arguments[2]);
    };
    this.trigger = function(fullName,args){
        if(arguments.length<=2){
            XO.$body.trigger(fullName,args);
            return;
        }
        $(arguments[0]).trigger(arguments[1],arguments[2]);
    };

    this.init = function(){
        //SYSTEM EVENTS
        XO.EVENT['Sys'] ={
            viewChange: 'onorientationchange' in window ? 'orientationchange' : 'resize',
            fingerDown: XO.support.touch ? 'touchstart' : 'mousedown',
            fingerMove: XO.support.touch ? 'touchmove' : 'mousemove',
            fingerUp: XO.support.touch ? 'touchend' : 'mouseup'
        };
    };

});

//plugin base module
XO('plugin',function($,C){
    //插件的公共方法
    var base = function(el, dataset){
        if(el.length && el.length != 0){
            $el = el;
        }else{
            $el = $(el);
        }
        this.$el = $el;
        this.dataset = dataset;
        this['plugin'] = dataset['plugin'];
        this['pluginId'] = dataset['pluginId'];
        this.init($el, dataset);
    }

    base.destroy = function(){
        this.$el.off('touchend');
        this.$el.off('touchstart');
        this.$el.off('touchmove');
        this.$el.off('tab');
        console.log('super destroy!');
    }

    base.init = function(){
        
    }

    base.bootup = function(dataset){

    }

    base.initEvent = function(){

    }

    base.on = function(type, fn, scope){
        var self = this;
        XO.Event.on(this.$el, type + '-' + this.plugin, function(e, scope){
            fn.call(self, scope);
        })
    }
    base.bind = function(){

    }

    base.trigger = function(type, args){
        //this.$el.trigger(type + '-' + this.plugin, args);   
        XO.Event.trigger(this.$el, type + '-' + this.plugin, args);
    }


    var _plugins={};
    var _idx = 0;

    this.get = function(id){
        return _plugins[id];
    }

    this._show = function(){
        console.dir(_plugins);
    }

    this.applyToView = function(view){
        this.applyToElement(view.$el);
    };

    this.applyToElement = function($el){
        var plugin, dataset, p; 
        $el.find('[data-plugin]').each(function(){
            var dataset = this.dataset;
            p_name = dataset['plugin'];
            p = new XO.plugin[p_name](this, dataset);
            p['name'] = p_name;
            if(dataset['pluginId']){
                _plugins[dataset['pluginId']] = p;
            }else{
                _plugins['p_' + _idx] = p;
                _idx++;
            }
        });
    };
    /**
     * 销毁视图内的插件。该方法在视图隐藏后自动调用
     */
    this.destroyInView = function(view){
        //TODO
    };

    this.bootup = function(view, args){
        for(var i in args){
           plugin = this.get(i);
           if(plugin)
                plugin.bootup(args[i]);
        }
    }

    this.define = function(name, prototype){
        prototype = prototype || {};
        var constr = function(){
            base.apply(this, arguments);
            this.super = base;
            this.name = name;
        };
        constr.prototype = (function(){
            var tmp = function(){};
            tmp.prototype = base;
            var proto = new tmp();
            for(var i in prototype){
                proto[i] = prototype[i];
            }
            return proto;
        })();
        XO.plugin[name] = constr;
    };

    this.init = function(){
        //动画结束
        XO.Event.on(XO.EVENT.Animate.End,function(e,data){
            if(data.isHiding){
                //视图隐藏，销毁插件
                XO.plugin.destroyInView(data.view);
            }else{
                //视图显示，初始化插件
                XO.plugin.applyToView(data.view);
                XO.plugin.bootup(data.view,data.view.pluginData);
            }
        });
    };

});


/**
 * Controller factory
 */
XO('Controller',function($,C){
    /**
     * define and register a controller
     * @param {String} pageId page id(controller id)
     * @param {Object} opts controller action dictionary
     */
    this.define = function(pageId,opts){

        XO.Controller[pageId]=$.extend(XO.Controller[pageId]||{},{
            id:pageId,
            viewId:function(vid){
                return XO.View.getId(pageId,vid);
            },
            /**
             * Render a view by viewid
             * @param {String} vid iew id
             * @param {Object} opts1 config object
             *         opts1.onRender callback function
             *         opts1.data data provider for the view
             */
            renderView:function(vid,opts1){
                this.renderExternalView(this.id,vid,opts1);
            },
            /**
             * Render a view by pageid and viewid,and render the view with specified data
             * @param {String} pid page id
             * @param {String} vid view id
             * @param {Object} opts1 config object
             *         opts1.onRender callback function
             *         opts1.data data provider for the view
             */
            renderExternalView:function(pid,vid,opts1){
                opts1 = $.extend({
                    onRender:function(err,view){},
                    data:{},
                    dataPointer:null,//internal pointer for the data object
                    hardRefresh:false,
                    param:null
                },opts1||{});

                var actionName = XO.Controller.getFullActionName(pid,vid),
                    me = this,
                    cbk = opts1.onRender,
                    data = opts1.data,
                    dataIsFunction = $.isFunction(data);

                //TODO:finish the switchTo function
                XO.View.switchTo(pid,vid,opts1.param,function(err,view,onGetViewData){
                    if(err){
                        cbk(actionName+err);
                        return;
                    }
                    if(!dataIsFunction){
                        onGetViewData(null,data);
                        cbk(null,view);
                        return;
                    }
                    data.call(opts1.dataPointer,opts1.param,function(err1,jsonData){
                        onGetViewData(err1,jsonData);
                        cbk(err1,view);
                    });

                },opts1.hardRefresh);
            }
        },opts||{});
    };

    this.getFullActionName = function(pid,vid,suffix){
        return ( 'Controller.'+pid+'.'+vid+(suffix||':') );
    };
    /**
     * 为指定视图定义对应控制器（Controller）的默认行为（action）
     * 注：这个方法会在ox.view.js里面_init方法中使用，目的是自动为视图生成一个控制器和对应的action
     * @param {String} pid page id
     * @param {String} vid view id
     * @param {Function} fnAction action
     */
    this.defineDefaultAction = function(pid,vid,fnAction){
        var actions = {},
            actionId = XO.CONST.DEFAULT.DEFAULT_ACTION_PREFIX+vid,
            action = null;

        //是否已经定义过
        if( XO.Controller[pid] && ( action = XO.Controller[pid][actionId] ) ){
            return action;
        }

        action = fnAction || XO.App.opts.defaultControllerAction || (function(param){
            this.renderView(vid,{
                param:param,
                data:function(params,cbk){
                    var jsonData = {hi:1};
                    cbk(null,jsonData);
                }
            });
        });
        actions[actionId] = action;
        this.define(pid,actions);
        return action;
    };
    /**
     * 调用指定action
     * @param {String} pid page id
     * @param {String} vid view id
     * @param {Object} param parameters
     */
    this.invoke = function(pid,vid,param){
        //获取用户定义的action，如果没有则使用默认的action。参考defineDefaultAction
        var controller = XO.Controller[pid],
            action =controller?(controller[vid]||controller[XO.CONST.DEFAULT.DEFAULT_ACTION_PREFIX+vid]):null,
            now = new Date(),
            todayStr = now.getFullYear()+"-"+now.getMonth()+"-"+now.getDate()+"";
        
        ////如果用户没有写controller的js，也没有写view的js，则自动生成controller和view，使用默认action显示静态模板。适用于纯静态app
        if( !action && XO.App.opts.autoControllerAndView ){
            //TODO:这里是否有优化空间
            XO.View.autoView({
                pid:pid,
                vid:vid,
                version:(param&&param.version)||todayStr
            });
            action = this.defineDefaultAction(pid,vid);
        }

        action.call(XO.Controller[pid],param);
    };

});

//Base View Module
XO('View',function($,C){
    this.exposeEvent([
        'Init',
        'InitFromRemote',
        'Inited',
        'InitedTemplate',
        'InitedTemplateError'
    ]);
    this.caches={};
    this.curViews={};

    this.defaultActions = {
        initialize:function(){
            this.isRendered = this.dir===null||typeof(this.dir)==='undefined';
            this.isRemote = (!this.isRendered && this.dir.indexOf(C.DEFAULT.TEMPLATE_SUFFIX)!==-1);
            this.$host = $(this.cssHost);
            XO.Event.trigger(XO.EVENT.View.Init,[this]);
            if(this.isRendered){
                this.initFromDom();
            }
        },
        initFromDom:function(){
            this.el = document.getElementById(this.id);
            if( this.el === null ){
                XO.warn('View404','View with id "'+this.id+'" not found!');
                return;
            };
            this.$el = $(this.el);
            this.animation = this.animation||(this.el.getAttribute[C.ATTR.ANIMATION]||XO.App.opts.defaultAnimation);
            //XO.Event.trigger(this,XO.EVENT.View.Inited,[this]);
            XO.Event.trigger(XO.EVENT.View.Inited,[this]);
            this.onRender&&this.onRender.call(this);
        },
        initFromRemote:function(cbk){
            XO.Event.trigger(XO.EVENT.View.InitFromRemote,[this]);
            //load from local storage
            var lsKey = XO.View.getLSKey(this.id),
                lsObj = XO.LS[lsKey],
                me = this;

            // local inline template
            if(!this.isRemote){
                this.tpl = document.getElementById(this.dir).innerHTML;
                XO.Event.trigger(XO.EVENT.View.InitedTemplate,[this]);
                cbk&&cbk(null,this);
                return;
            };
            // remote template
            this.src = this.dir+this.pid+'/'+this.vid+'.html';
            // check localstorage firstly
            if(lsObj&&(lsObj = JSON.parse(lsObj))&&lsObj.src===this.src&&lsObj.version===this.version&&!XO.App.opts.debug){
                this.tpl = lsObj.tpl;
                XO.Event.trigger(XO.EVENT.View.InitedTemplate,[this]);
                cbk&&cbk(null,this);
                return;
            };
            //load from remote url
            $.ajax({
                url:this.src,
                cache:false,
                success:function(data,status,xhr){
                    me.tpl = data;
                    //save to LS
                    XO.LS[lsKey] = JSON.stringify({
                        tpl:data,
                        src:me.src,
                        version:me.version
                    });
                    XO.Event.trigger(XO.EVENT.View.InitedTemplate,[me]);
                    cbk&&cbk(null,me);
                },
                error:function(xhr,errorType,error){
                    XO.Event.trigger(XO.EVENT.View.InitedTemplateError,[me]);
                    cbk&&cbk(errorType+error.toString());
                }
            });
        },
        destroy:function(){
            this.remove();
            this.isRendered = false;
        }, 
        //render a page with specified data
        render:function(data){
            
            var html = XO.toHtml(this.tpl,data);
            this.$host.prepend(html);
            this.isRendered = true;
            this.initFromDom();
        },
        /**
         * 显示视图
         * @param {Object} aniObj animation object
         * @param {Object} cfg config object
         *                 cfg.onStart 动画开始回调
         *                 cfg.onEnd 动画结束回调
         * @param {Boolean} noReplaceCurrentView 是否覆盖当前view，对于loader这些公共视图，不应该覆盖当前view
         */
        animateIn:function(aniObj,cfg,noReplaceCurrentView){

            //隐藏Loading
            XO.View.uiLoader.hide();

            if(XO.Animate.animateIn(this,aniObj,cfg)&&!noReplaceCurrentView){
                XO.View.setCurView(this,this.pid);
            }

            XO.ViewManager.push(this);
        },
        /**
         * 隐藏视图
         * @param {Object} aniObj animation object
         * @param {Object} cfg config object
         *                 cfg.onStart 动画开始回调
         *                 cfg.onEnd 动画结束回调
         */
        animateOut:function(aniObj,cfg ){
            XO.Animate.animateOut(this,aniObj,cfg);
        }
    };
    /**
     * 定义视图
     * @example
     *     XO.View.define({pid:'pageId','vid':'viewId'});
     */
    this.define = function(opts,initAtOnce){
        opts = opts || {};
        //check pid&vid
        if( (!opts.pid) || (!opts.vid) ){
            XO.warn('Parameters require! pid and vid required!');
            return false;
        }

        this.curViews[opts.pid] = this.curViews[opts.pid] ||{};
        opts.cssHost = opts.cssHost||C.SELECTOR.DEFAULT_CSS_HOST;
        opts.id = this.getId(opts.pid,opts.vid);
        opts = $.extend(opts,this.defaultActions);
        opts.isInited = false;
        this.caches[opts.id] = opts;

        if(initAtOnce){
            return this._init(opts);
        }
    };

    this.autoView = function(opts){
        var id = this.getId(opts.pid,opts.vid),
            view = this.caches[id];
        if(!view){
            view = this.define(opts,true);
        }else{
            //update version property
            view.version = opts.version||view.version;
        }
        return view;
    };

    this._init = function(viewOpts){
        if(XO.App&&XO.App.opts){
            viewOpts.dir = viewOpts.dir===null?null:XO.App.opts.viewDir;
        }
        var tempView = XO.baseView.extend(viewOpts);
        tempView.id = viewOpts.id;
        tempView = new tempView();
        if(tempView.init){
            tempView.init.call(tempView);
            delete tempView.init;
        };
        tempView.isInited = true;
        this.caches[tempView.id] = tempView;
        
        if(tempView.alias){
            (!this[tempView.alias]) && (this[tempView.alias]=tempView);
        }

        //generate default action
        XO.Controller.defineDefaultAction(tempView.pid,tempView.vid);

        return tempView;
    };

    /**
     * 获取用户自定义的视图
     * @param {String} pid page id
     * @param {String} vid view id
     * @param {Function} cbk callback
     * @param {Function} onPreloadFromRemote 从远程url获取模板时的回调
     */
    this.get = function(pid,vid,cbk,onPreloadFromRemote){

        var id = this.getId(pid,vid),
            view = this.caches[id];
        
        if(!view){
            cbk(XO.warn('View with id ['+id+'] not found!'));
            return;
        }

        if(view.isRendered){
            cbk(null,view);
            return;
        }
        //从远程获取视图模板
        if (!onPreloadFromRemote) {
            view.initFromRemote(cbk);
            return;
        };
        onPreloadFromRemote.call(view,function(){
            view.initFromRemote(cbk);
        });
    };
    /**
     * 生成视图的ID
     */
    this.getId = function(pid,vid){
        return [C.DEFAULT.VIEW_ID_PREFIX,pid,vid].join('-');
    };
    /**
     * 设置当前视图
     * @param {Object} view XO.View object
     * @param {String} pageId view's page id
     */
    this.setCurView = function(view,pageId){
        if(pageId){
            this.curViews[pageId].curView = view;
        };
        this.curViews['curView'] = view;
    };
    /**
     * 获取当前视图
     */
    this.getCurView = function(pageId){
        if(pageId){
            return this.curViews[pageId].curView;
        }
        return this.curViews.curView;
    };
    //switch Pages or Sections
    this.switch = function(from, to, aniName, goingBack,pageId) {

        goingBack = goingBack || false;

        if(!XO.Animate.switch(from,to,aniName,goingBack)){
            return false;
        }

        XO.View.setCurView(to,pageId);

        return true;
    };//switch
    /**
     * switch Pages or Sections
     * @param {Function} cbk cbb(err,view,onGetViewData)
     */
    this.switchTo = function(pid,vid,aniObj,cbk,forceRefresh){
        var curView = this.getCurView(),
            onViewGot = function(err,view){
                if(err){
                    XO.warn('XO.View.switchTo:'+err);
                    cbk(err);
                    return;
                }
                if(view.isRendered&&!forceRefresh){
                    view.animateIn(aniObj);
                    return;
                }
                cbk(null,view,function(err1,data1){
                    if(err1){
                        //获取数据出错
                        XO.warn('XO.View.switchTo:'+err1);
                        return;
                    }
                    //渲染视图
                    view.render(data1);
                    view.animateIn({animation:'none'});
                });
            },
            onPreloadFromRemote = function(loadFromRemote){
                //切进loading
                XO.View.uiLoader.animateIn(aniObj,{
                    onEnd:loadFromRemote
                },true);
            };

        //移出当前view
        if(curView){
            curView.animateOut(aniObj);
        }
        //加载目标视图
        this.get(pid,vid,onViewGot,onPreloadFromRemote);
    };

    this.init = function(){
        //初始化所有未初始化的视图
        for(var v in this.caches){
            if(this.caches[v].isInited) {
                continue;
            };
            this._init(this.caches[v]);
        };
    };

});

XO('ViewManager', function($,C){

	var views = {},
        size = 0,
        liveViews = {},
        liveSize = 0,
        liveViewIds = [];

    this.push = function(view){
        
        if(view.excludeFromViewManager) return;
        
        var cache = views[view.id],
            tempViewIds = [];
        if(!cache){
            size++;
        }
        
        views[view.id] = view;
        
        cache = liveViews[view.id];
        if(!cache){
            liveSize++;
            liveViews[view.id] = view;
            liveViewIds.push(view.id);
        }else{
            for(var i=0;i<liveSize;i++){
                if(liveViewIds[i]!==view.id){
                    tempViewIds.push(liveViewIds[i]);    
                }    
            };    
            tempViewIds.push(view.id);
            liveViewIds = tempViewIds;
        }

        var idToBeDestroyed = liveSize > XO.App.opts.maxViewSizeInDom ? liveViewIds.shift():null;
        if( idToBeDestroyed ){
            views[idToBeDestroyed].destroy();
            delete liveViews[idToBeDestroyed];
            liveSize --;

        };

    };

    this.size = function(isLive){
        return (isLive ? liveSize:size);
    };
    

});

XO.View.define({
    pid:'common',
    vid:'mask',
    alias:'uiMask',
    dir:null,//dir为null说明为页面中已经存在的视图
    excludeFromViewManager:true,
    isMasking:false,
    show:function(){
        if(this.isMasking)
            return;
        
        this.isMasking = true;
        this.$el.removeClass(XO.CONST.CLASS.HIDE);
    },
    hide:function(){
        this.$el.addClass(XO.CONST.CLASS.HIDE);
        this.isMasking = false;
    }
});

XO.View.define({
    pid:'common',
    vid:'loader',
    alias:'uiLoader',
    dir:null,//dir为null说明为页面中已经存在的视图
    isLoading:false,
    excludeFromViewManager:true,
    show:function(){
        if(this.isLoading)
            return;
        this.isLoading = true;
        this.$el.removeClass(XO.CONST.CLASS.HIDE);
    },
    hide:function(){
        this.$el.addClass(XO.CONST.CLASS.HIDE).removeClass(XO.CONST.CLASS.ACTIVE);
        this.isLoading = false;
    }
});

/**
 * 调试模块XO.View.uiLogger.log('xxxx','yyy')
 */
XO.View.define({
    pid:'common',
    vid:'logger',
    alias:'uiLogger',
    dir:null,//dir为null说明为页面中已经存在的视图
    init:function(){
        this.$bd = this.$el.find('.xo_logger_bd');
    },
    log:function(txt,key){
        key = key||'null';
        this.$bd.append(key+':<div class="xo_logger_txt">'+txt+'</div>');
        return this;
    },
    show:function(){
        this.$el.removeClass(XO.CONST.CLASS.HIDE);
        return this;
    },
    hide:function(){
        this.$el.addClass(XO.CONST.CLASS.HIDE);
        return this;
    }
});
XO('Router',function($,C){

    this.defaultRouteIndex = 1000;

    this.init = function(opts){
        var customRoutes = opts.routes||{
            ':page': 'showPage',
            ':page/:view':'showPage',
            ':page/:view/:data': 'showPage',
            ':page/section/:section':'showSection',
            ':page/section/:section/:param':'showSection',
            ':page/aside/:aside':'showAside',
            ':page/aside/:aside/:param':'showAside',
            ':page/popup/:popup':'showPopup',
            ':page/popup/:popup/:param':'showPopup',
            "*actions": "defaultRoute"
        };

        //routes
        var Router = XO.baseRouter.extend({
            routes: customRoutes,
            initialize:function(){
                this.on({
                    "route":this.onRoute,
                    "route:defaultRoute":this.onDefaultRoute
                });
                // Handling clicks on links, except those with link
                // remove strings to xo.constants.js
                // data-ridx 可以用来控制多个链接之间的跳转顺序，从而控制动画是向前还是向后
                XO.$doc.on("click", "a:not([data-notrouter])", function (evt) {
                    var href = $(this).attr("href"),
                        protocol = this.protocol + "//",
                        rIdx0 = XO.Router.instance.rIndex,
                        rIdx = null,
                        isBack = false;
                        XO.Router.instance.linkClicked = true;
                        XO.Router.instance.isGoback = false;
                    if (href && href.slice(0, protocol.length) !== protocol && href.indexOf("javascript") !== 0) {
                        evt.preventDefault();

                        if(XO.Animate.isAnimating()) return;

                        rIdx = this.getAttribute('data-ridx');
                        rIdx = rIdx ? (parseInt(rIdx)||0): XO.Router.defaultRouteIndex;
                        isBack = this.getAttribute('data-back');

                        if (!isBack && rIdx<rIdx0) {
                            isBack = href;
                        };

                        href = isBack||href;
                        XO.Router.instance.isGoback = isBack;
                        XO.Router.instance.rIndex = rIdx;
                        XO.history.navigate(href, true);
                        return;
                    }
                    //reset route index
                    XO.Router.instance.rIndex = XO.Router.defaultRouteIndex;
                }).on('click','button',function(evt){
                    XO.Router.instance.linkClicked = true;
                    XO.Router.instance.isGoback = this.getAttribute('data-back');
                    if(!XO.Router.instance.isGoback) return;
                    evt.preventDefault();
                    if(XO.Animate.isAnimating()) return;
                    XO.history.navigate(XO.Router.instance.isGoback, true);
                });
            },
            showPage: function(pageId,viewId,param){
                
                if(pageId.indexOf('notrouter')===0){
                    return;    
                }

                viewId = viewId||'index';
                param= JSON.parse(param||'{}');
                var aniName = (!this.linkClicked)?C.DEFAULT.ANIMATION_NONE:null,
                    viewObj = {
                        pid:pageId,
                        vid:viewId,
                        animation:aniName,
                        back:this.isGoback,
                        dir:XO.App.opts.viewDir,
                        type:C.ACTION.PAGE,
                        cssHost:C.SELECTOR.PAGE_WRAPPER
                    };
                viewObj.params = param;
                XO.Controller.invoke(pageId,viewId,viewObj);
                this.isGoback = false;
                this.linkClicked = false;
            },
            showSection:function(pageId,secId,param){
                console.log('showSection',{pid:pageId,secId:secId,param:param});
            },
            showAside:function(pageId,asId,param){
                console.log('showAside',{pid:pageId,asId:asId,param:param});
            },
            showPopup:function(pageId,popId,param){
                console.log('showPopup',{pid:pageId,popId:popId,param:param});
            },
            isGoback:false,         //whether is back route
            rIndex:-1,              //route index
            onRoute:function(actions,param){
                console.log('onRoute',actions,param);
            },
            onDefaultRoute:function(actions){
                console.log("Intercepted call of default router: " + actions);
            }
            
        });

        this.instance = new Router();

    };
});

/**
 * Animation module
 */
XO('Animate',function($,C){

    this.exposeEvent([
        'Start',
        'End'
    ]);
    //ref:https://github.com/senchalabs/jQTouch/blob/master/src/jqtouch.js
    this.animations = { // highest to lowest priority
        'cubeleft':{name:'cubeleft', is3d: true},
        'cuberight':{name:'cuberight', is3d: true},
        'dissolve':{name:'dissolve'},
        'fade':{name:'fade'},
        'flipleft':{name:'flipleft',is3d: true},
        'flipright':{name:'flipright',is3d: true},
        'pop':{name:'pop', is3d: true},
        'swapleft':{name:'swapleft', is3d: true},
        'swapright':{name:'swapright', is3d: true},
        'slidedown':{name:'slidedown'},
        'slideright':{name:'slideright'},
        'slideup':{name:'slideup'},
        'slideleft':{name:'slideleft'},
        'pokerleft':{name:'pokerleft',is3d:true},
        'none':{name:'none'}
    };

    this.getReverseAnimation = function(animation) {
        var opposites={
            'up' : 'down',
            'down' : 'up',
            'left' : 'right',
            'right' : 'left',
            'in' : 'out',
            'out' : 'in'
        };
        return opposites[animation] || animation;
    }

    this.add = function(aniObj){
        this.animations[aniObj.name]=aniObj;
    };

    this.get = function(name){
        return this.animations[name]||this.animations[XO.App.opts.defaultAnimation];
    };

    this.unselect = function($obj){
        if($obj){
            $obj.removeClass(C.CLASS.UIACTIVE);
            $obj.find('.'+C.CLASS.UIACTIVE).removeClass(C.CLASS.UIACTIVE);
            return;
        }
        $('.'+C.CLASS.UIACTIVE).removeClass(C.CLASS.UIACTIVE);
    };

    this.makeActive = function($obj){
        $obj.addClass(C.CLASS.UIACTIVE);
    };

    /**
     * animate in a view
     */
    this.animateIn = function(view,aniObj,cfg){
        var aniName = aniObj.animation,
            animation = this.get(aniName),
            goingBack = aniObj.back||false,
            $el = view.$el,
            finalAnimationName = '',
            is3d,
            eventData,
            needAnimation = false;

        aniObj.animation = animation.name;

        cfg = cfg||{};

        animation = animation.name!==C.DEFAULT.ANIMATION_NONE?animation:null;

        XO.Animate.isAnimatingIn = false;

        eventData = { 
            "direction": C.CLASS.ANIMATION_IN, 
            "back": goingBack ,
            "animation":animation,
            "view":view,
            "isHiding":false
        };

        // Error check for target page
        if ($el === undefined || $el.length === 0) {
            this.unselect();
            XO.warn('XO.Animate.animateIn:Target element is missing.');
            return false;
        }

        // Error check for $from === $to
        if ($el.hasClass(C.CLASS.ACTIVE)) {
            this.unselect();
            XO.warn('XO.Animate.animateIn:You are already on the page you are trying to navigate to.');
            return false;
        }

        //XO.View.uiLogger&&XO.View.uiLogger.log('animateIn:'+JSON.stringify(aniObj),view.id);

        // Collapse the keyboard
        $(':focus').trigger('blur');

        XO.Event.trigger(view,XO.EVENT.Animate.Start, [eventData]);
        //user callback
        view.onAnimating&&view.onAnimating.call(view,eventData);
        //framework callback
        cfg.onStart&&cfg.onStart.call(view);

        needAnimation = XO.support.animationEvents && animation && XO.App.opts.useAnimations;

        if (needAnimation) {
            // Fail over to 2d animation if need be
            if (!XO.support.transform3d && animation.is3d) {
                XO.warn('XO.Animate.animateIn:Did not detect support for 3d animations, falling back to ' + XO.App.opts.defaultAnimation + '.');
                animation.name = XO.App.opts.defaultAnimation;
            }

            // Reverse animation if need be
            finalAnimationName = animation.name;
            is3d = animation.is3d ? (' '+C.CLASS.ANIMATION_3D) : '';

            if (goingBack) {
                finalAnimationName = finalAnimationName.replace(/left|right|up|down|in|out/, this.getReverseAnimation);
            }

            XO.warn('XO.Animate.animateIn: finalAnimationName is ' + finalAnimationName + '.');

            // Bind internal 'cleanup' callback
            $el.on('webkitAnimationEnd', animatedInHandler);

            // Trigger animations
            XO.$body.addClass(C.CLASS.ANIMATING + is3d);

            /*
            var lastScroll = window.pageYOffset;

            // Position the incoming page so toolbar is at top of
            // viewport regardless of scroll position on from page
            if (XO.App.opts.trackScrollPositions === true) {
                $to.css('top', window.pageYOffset - ($to.data('lastScroll') || 0));
            }
            */
            if($.os.iphone){
                //解决ios动画不同步或者animationEnd事件在动画结束之前触发的bug
                setTimeout(function(){
                    $el.removeClass(C.CLASS.HIDE).addClass([finalAnimationName,C.CLASS.ANIMATION_IN,C.CLASS.ACTIVE].join(' '));
                },0);
            }else{
                $el.removeClass(C.CLASS.HIDE).addClass([finalAnimationName,C.CLASS.ANIMATION_IN,C.CLASS.ACTIVE].join(' '));
            }
            
            
            XO.Animate.isAnimatingIn = true;
            /*
            if (XO.App.opts.trackScrollPositions === true) {
                $from.data('lastScroll', lastScroll);
                $('.scroll', $from).each(function() {
                    $(this).data('lastScroll', this.scrollTop);
                });
            }
            */
        } else {
            $el.removeClass(C.CLASS.HIDE).addClass([C.CLASS.ACTIVE,C.CLASS.ANIMATION_IN].join(' '));
            animatedInHandler();
        }

        /*
        if (goingBack) {
            history.shift();
        } else {
            addPageToHistory(XO.View.$curView, animation);
        }
        setHash(XO.View.$curView.attr('id'));
        */

        // Private navigationEnd callback
        function animatedInHandler(evt) {
            //prevent child elements's event bubbling
            if(evt && evt.target!==evt.currentTarget) return;

            var clIn = [finalAnimationName,C.CLASS.ANIMATION_IN].join(' ');
            XO.Animate.isAnimatingIn  = false;

            if (needAnimation) {
                $el.off('webkitAnimationEnd', animatedInHandler).removeClass(clIn);

                if(!XO.Animate.isAnimating()){
                    XO.$body.removeClass(C.CLASS.ANIMATING +' '+C.CLASS.ANIMATION_3D);
                }
                /*
                if (XO.App.opts.trackScrollPositions === true) {
                    $to.css('top', -$to.data('lastScroll'));

                    // Have to make sure the scroll/style resets
                    // are outside the flow of this function.
                    setTimeout(function() {
                        $to.css('top', 0);
                        window.scroll(0, $to.data('lastScroll'));
                        $('.scroll', $to).each(function() {
                            this.scrollTop = - $(this).data('lastScroll');
                        });
                    }, 0);
                }
                */
            } else {
                $el.removeClass(clIn);
            }

            // Trigger custom events
            XO.Event.trigger(view,XO.EVENT.Animate.End, [eventData]);
            XO.Event.trigger(XO.EVENT.Animate.End,[eventData]);
            // user callback
            view.onAnimated&&view.onAnimated.call(view,eventData);
            //framework callback
            cfg.onEnd&&cfg.onEnd.call(view);

            XO.View.uiLogger&&XO.View.uiLogger.log('animatedInHandler:'+JSON.stringify(aniObj),view.id)
        }
        return true;
    };
    /**
     * animate out a view
     */
    this.animateOut = function(view,aniObj,cfg){
        var aniName = aniObj.animation,
            animation = this.get(aniName),
            $el = view.$el,
            goingBack = aniObj.back||false,
            finalAnimationName = '',
            is3d,
            eventData,
            needAnimation = false;

        aniObj.animation = animation.name;

        cfg = cfg||{};

        animation = animation.name!==C.DEFAULT.ANIMATION_NONE?animation:null;

        XO.Animate.isAnimatingOut  = false;

        eventData = { 
            "direction": C.CLASS.ANIMATION_OUT, 
            "back": goingBack ,
            "animation":animation,
            "view":view,
            "isHiding":true
        };
        // Error check for target page
        if ($el === undefined || $el.length === 0) {
            XO.warn('XO.Animate.animateOut:Target element is missing.');
            return false;
        }
        // Collapse the keyboard
        //$(':focus').trigger('blur');

        //XO.View.uiLogger&&XO.View.uiLogger.log('animateOut:'+JSON.stringify(aniObj),view.id);

        XO.Event.trigger(view,XO.EVENT.Animate.Start, [eventData]);
        //user's custom view callback
        view.onAnimating&&view.onAnimating.call(view,eventData);
        //framework's internal view callback
        cfg.onStart&&cfg.onStart.call(view);

        needAnimation = XO.support.animationEvents && animation && XO.App.opts.useAnimations;

        if (needAnimation) {
            // Fail over to 2d animation if need be
            if (!XO.support.transform3d && animation.is3d) {
                XO.warn('XO.Animate.animateOut:Did not detect support for 3d animations, falling back to ' + XO.App.opts.defaultAnimation + '.');
                animation.name = XO.App.opts.defaultAnimation;
            }

            // Reverse animation if need be
            finalAnimationName = animation.name;
            is3d = animation.is3d ? (' '+C.CLASS.ANIMATION_3D) : '';

            if (goingBack) {
                finalAnimationName = finalAnimationName.replace(/left|right|up|down|in|out/, this.getReverseAnimation);
            }

            XO.warn('XO.Animate.animateOut: finalAnimationName is ' + finalAnimationName + '.');

            // Bind internal 'cleanup' callback
            $el.on('webkitAnimationEnd', animatedOutHandler);

            // Trigger animations
            XO.$body.addClass(C.CLASS.ANIMATING + is3d);

            /*
            var lastScroll = window.pageYOffset;

            // Position the incoming page so toolbar is at top of
            // viewport regardless of scroll position on from page
            if (XO.App.opts.trackScrollPositions === true) {
                $to.css('top', window.pageYOffset - ($to.data('lastScroll') || 0));
            }
            */
            if($.os.iphone){
                //解决ios动画不同步或者animationEnd事件在动画结束之前触发的bug
                setTimeout(function(){
                    $el.removeClass(C.CLASS.ACTIVE).addClass([finalAnimationName,C.CLASS.ANIMATION_OUT, C.CLASS.ANIMATION_INMOTION].join(' '));
                },0);
            }else{
                $el.removeClass(C.CLASS.ACTIVE).addClass([finalAnimationName,C.CLASS.ANIMATION_OUT, C.CLASS.ANIMATION_INMOTION].join(' '));
            }
            
            
            XO.Animate.isAnimatingOut  = true;
            /*
            if (XO.App.opts.trackScrollPositions === true) {
                $from.data('lastScroll', lastScroll);
                $('.scroll', $from).each(function() {
                    $(this).data('lastScroll', this.scrollTop);
                });
            }
            */
        } else {
            $el.removeClass(C.CLASS.ACTIVE);
            animatedOutHandler();
        }

        /*
        if (goingBack) {
            history.shift();
        } else {
            addPageToHistory(XO.View.$curView, animation);
        }
        setHash(XO.View.$curView.attr('id'));
        */

        // Private navigationEnd callback
        function animatedOutHandler(evt) {
            //prevent child elements's event bubbling
            if(evt && evt.target!==evt.currentTarget) return;

            var clOut = [finalAnimationName,C.CLASS.ANIMATION_OUT,C.CLASS.ANIMATION_INMOTION].join(' ');
            XO.Animate.isAnimatingOut  = false;
            if (needAnimation) {
                $el.off('webkitAnimationEnd', animatedOutHandler).removeClass(clOut);
                if(!XO.Animate.isAnimating()){
                    XO.$body.removeClass(C.CLASS.ANIMATING +' '+C.CLASS.ANIMATION_3D);
                }
                /*
                if (XO.App.opts.trackScrollPositions === true) {
                    $to.css('top', -$to.data('lastScroll'));

                    // Have to make sure the scroll/style resets
                    // are outside the flow of this function.
                    setTimeout(function() {
                        $to.css('top', 0);
                        window.scroll(0, $to.data('lastScroll'));
                        $('.scroll', $to).each(function() {
                            this.scrollTop = - $(this).data('lastScroll');
                        });
                    }, 0);
                }
                */
            }

            XO.Animate.unselect($el);

            // Trigger custom events
            XO.Event.trigger(view,XO.EVENT.Animate.End, [eventData]);
            XO.Event.trigger(XO.EVENT.Animate.End, [eventData]);
            // user's custom callback
            view.onAnimated&&view.onAnimated.call(view,eventData);
            // framework's callback
            cfg.onEnd&&cfg.onEnd.call(view);
        }
        return true;
    };
    /**
     * 页面是否处于动画中
     */
    this.isAnimating = function(){
        return (this.isAnimatingIn||this.isAnimatingOut);

    };
    /**
     * 是否动画显示中
     */
    this.isAnimatingIn = false;
    /**
     * 是否动画隐藏中
     */
    this.isAnimatingOut = false;

});
XO('App',function($,C){

    //隐藏地址栏
    this.hideAddressBar = function(){
        window.scrollTo(0,0);
    };

    this.init = function(opts){

        var dummyTplEngine = {
            compile:function(tpl){
                return ({
                    tpl:tpl,
                    render:function(data){
                        return this.tpl;
                    }
                });
            }
        };

        this.opts = $.extend({
            T:window['Hogan']||dummyTplEngine,  //custom template engine implementation
            baseRouter:XO.Base.Router,          //custom router implementation
            history:XO.Base.history,            //custom history implementation
            baseView:XO.Base.View,              //custom view implementation
            useFastTouch:true,
            useAnimations:true,
            useTransform3D:true,
            defaultAnimation:'none',
            trackScrollPositions:true,
            useTouchScroll:true,
            maxViewSizeInDom:2,
            debug:false,
            defaultPage:C.DEFAULT.PAGE,
            defaultView:C.DEFAULT.VIEW,
            defaultControllerAction:null,
            autoControllerAndView:true,          //如果用户没有写controller的js，也没有写view的js，则自动生成controller和view，使用默认action显示静态模板。适用于纯静态app
            viewDir:XO.$body[0].getAttribute('data-viewdir')||'assets/html/'
        },opts||{});

        //shortcuts for T,baseRouter,history,baseView
        XO["T"] = this.opts.T;
        XO["baseRouter"] = this.opts.baseRouter;
        XO["history"] = this.opts.history;
        XO["baseView"] = this.opts.baseView;

        if(this.opts.useFastTouch){
            //fastclick https://github.com/ftlabs/fastclick
            FastClick.attach(document.body);
        }

        //delete self's init method
        delete this.init;
        //init all modules
        for(var c in XO){
            XO[c].init&&XO[c].init.call(XO[c],this.opts);
            delete XO[c].init;
        };

        //旋屏
        window.addEventListener(XO.EVENT.Sys.viewChange, this.hideAddressBar);

        this.hideAddressBar();
        
        //插件初始化
        XO.plugin.applyToElement(XO.$body);

        //hashchange
        XO.history.start();
        //XO.history.start({pushState:true});
        
        //default page and view
        var page = this.opts.defaultPage;
        if(!window.location.hash.substring(1)){
            XO.Router.instance.navigate(page, {trigger: true, replace: true});
        }

        XO.support.touch && window.addEventListener('touchstart', function(){
            XO.App.hideAddressBar();
        }, true);

    };
});
