/**
 * Analytics
 *
 * @example https://github.com/robflaherty/jquery-scrolldepth/blob/master/jquery.scrolldepth.js
 * @example http://screentime.parsnip.io/
 *
 * @version 1.0.1
 *
 * 2016-01-04
 * - added enable() and disable()
 * - added old _gaq tracking
 */
var Analytics = (function (){
	var _ = this,
		$ = jQuery;

	// CONSTANTS ---------------------------------------------
	var EXTERNAL_LINK_DELAY = 200;

	var THROTTLE_DELAY      = 300;

	var TIMING_DELAY 	    = 5000;

	// VARIABLES ---------------------------------------------
	var _doc             = $(document),
		_win             = $(window),
		_scrollables 	 = {},
		_timing 		 = [],
		_cache 			 = {},
		_enabled 		 = {'screenTime': true, 'externalLinks':true, 'scroll':true, 'historyChange':true},
		_args 			 = {};

	_args.trackScreenTimeRange = 30 * 1000; // 30sec
	_args.trackTimeRange       = 10 * 1000; // 10sec
	_args.trackTimeMax 		   = 5 * 60 * 1000; // 5min
	_args.scrollRange 	       = 0.20;
	_args.scrollFix 	       = 15;
	_args.debug 		       = false;

	// CONSTRUCTORS ------------------------------------------
	function init (){
		_win.load(function (){
			void trackExternalLinks();
			void trackHistoryChange();
			void trackScroll('Screen', window);
			void trackTime('Screen', window);
		});

		return _;
	};

	// PRIVATE FUNCTIONS -------------------------------------
	function findScrollableParent (){
		var element 	= this,
			scrollable  = null;

		while (element.length && !scrollable){
			if (element.is(document) || element.is('html')) break;

			var height 		= element.innerHeight(),
				scrollH		= element.prop('scrollHeight'),
				overflowY	= element.css('overflow-y');

			if (overflowY == 'scroll' || (scrollH > height && overflowY == 'auto')) scrollable = element;
			element = element.parent();
		}

		return scrollable;
	};

	function findElementProgress (element, scrollTop, winHeight){
		if (scrollTop === undefined) scrollTop = _win.scrollTop();
		if (winHeight === undefined) winHeight = _win.height();

		var top 	= element.offset().top - winHeight,
			height 	= element.height();

		return (scrollTop - top) / height;
	};

	function parseTime (time){
		var s 		= parseInt(time/1000, 10),
			hours   = Math.floor(s / 3600),
			minutes = Math.floor((s - (hours * 3600)) / 60),
			seconds = s - (hours * 3600) - (minutes * 60),
			ms 		= Math.round(time % 1 * 1000);

		if (hours   < 10) {hours   = "0"+hours;}
		if (minutes < 10) {minutes = "0"+minutes;}
		if (seconds < 10) {seconds = "0"+seconds;}

		return hours+':'+minutes+':'+seconds;
	};

	function track (){
		var args = Array.prototype.slice.call(arguments);

		if (_args.debug){
			console.log(['ANALYTICS TRACKING'].concat(args));
		}else if (window.ga){
			ga.apply(null, args);
		}else if (window._gaq){
			var args = Array.prototype.slice.call(arguments),
				send = [];

			if (args[1] == 'event'){
				send.push('_trackEvent');
			}else if (args[1] == 'pageview'){
				send.push('_trackPageview');
			}

			send = send.concat(args.slice(2));

			_gaq.push(send);
		}
	};

	function trackExternalLinks (){
		var filetypes 	= /\.(zip|exe|pdf|doc*|xls*|ppt*|mp3)$/i,
			base 		= $('base').attr('href') || '',
			links     	= $('a');

		// Tracking external links
		links.each(function (){
			var link 		= $(this),
				href 		= link.attr('href'),
				isExternal  = href && (href.match(/^https?\:/i)) && (!href.match(document.domain)),
				isEmail 	= href && href.match(/^mailto\:/i),
				isFile 		= href && href.match(filetypes),
				isBlank 	= (link.attr('target') || '').toLowerCase() === '_blank';

			link.on('click', function (e){
				if (_enabled['externalLinks'] === false) return;

				if (isFile){
					var extension = (/[.]/.exec(href)) ? /[^.]+$/.exec(href) : undefined;
					track('send', 'event', 'Download Link', 'Click-'+extension, href);

					if (!isBlank){
						e.preventDefault();
						setTimeout(function (){ location.href = base + href; }, EXTERNAL_LINK_DELAY);
					}
				}else if (isExternal){
					var externalLink = href.replace(/^https?\:\/\//i, '');
					track('send', 'event', 'External Link', 'Click', externalLink);

					if (!isBlank){
						e.preventDefault();
						setTimeout(function (){ location.href = href; }, EXTERNAL_LINK_DELAY);
					}
				}else if (isEmail){
					var mailLink = href.replace(/^mailto\:/i, '');
					track('send', 'event', 'Email Link', 'Click', externalLink);

					if (!isBlank){
						e.preventDefault();
						setTimeout(function (){ location.href = href; }, EXTERNAL_LINK_DELAY);
					}
				}
			});
		});
	};

	function trackScroll (category, element){
		var element 	   = $(element),
			parent 	       = findScrollableParent() || _win,
			isParentWindow = parent.get(0) === window,
			isBusy         = false;

		// add element to parent scrolling
		if (_scrollables[parent]){
			_scrollables[parent].push({
				'category' 	: category,
				'element'	: element
			});
			return;
		}

		_scrollables[parent] = [{
			'category' 	: category,
			'element'	: element
		}];

		parent.on('scroll.analyticTracking', function (){
			if (isBusy || _enabled['scroll'] === false) return;

			isBusy = true;
			setTimeout(function (){
				for (var i in _scrollables[parent]){
					var element      = _scrollables[parent][i].element,
						category 	 = _scrollables[parent][i].category,
						isWindow     = element.get(0) === window,
						winHeight 	 = _win.height(),
						scrollTop    = parent.scrollTop(),
						scrollHeight = isWindow ? (_doc.height() - winHeight - _args.scrollFix) : parent.prop('scrollHeight'),
						progress 	 = 0,
						label 		 = '',
						cacheKey 	 = null;

					if (isWindow){
						progress = scrollTop / scrollHeight;
					}else if (isParentWindow){
						progress = findElementProgress(element, scrollTop, winHeight);
					}else{
						throw 'TODO: Tracking of non-window scrollable parent (fixed element for example) is not yet supported';
					}

					if (progress > 0){
						progress     = parseInt(progress / _args.scrollRange, 10) * _args.scrollRange;
						progress     = progress > 1 ? 1 : progress;
						label 	 	 = parseInt(progress * 100, 10) + '%';
						cacheKey 	 = 'scroll-'+category+'-'+label;
					}

					if (cacheKey && !_cache[cacheKey] && progress > 0){
						track('send', 'event', 'Scroll '+category, 'Scrolling', label);
						_cache[cacheKey] = true;
					}
				}

				isBusy = false;
			}, THROTTLE_DELAY);
		});
	};

	function trackTime (category, element){
		var hasItems = !!_timing.length;

		// add the item
		_timing.push({'category':category, 'element':$(element), 'startTime':0});

		// already had items, skip the rest
		if (hasItems) return;

		function tick (){
			if (_enabled['screenTime'] === false) return setTimeout(tick, TIMING_DELAY);

			var now = +new Date();

			for (var i in _timing){
				var element      = _timing[i].element,
					category 	 = _timing[i].category,
					isWindow     = element.get(0) === window,
					scrollTop 	 = _win.scrollTop(),
					winHeight 	 = _win.height(),
					progress 	 = 0,
					label 		 = '',
					cacheKey 	 = null;

				if (isWindow){
					if (!_timing[i].startTime) _timing[i].startTime = now;
					//progress = now - _timing[i].startTime;
				}else{
					var scrollProgress = findElementProgress(element, scrollTop, winHeight/2);

					// in view (the winHeight is divised by 2 to give an offset)
					if (scrollProgress > 0 && scrollProgress <= 1){
						if (!_timing[i].startTime) _timing[i].startTime = now;
					}else{
						_timing[i].startTime = 0;
					}
				}

				if (_timing[i].startTime){
					var range = isWindow ? _args.trackScreenTimeRange : _args.trackTimeRange;

					progress = now - _timing[i].startTime;
					progress = parseInt(progress / range, 10) * range;

					if (progress){
						label 	 = progress > _args.trackTimeMax ? 'More than '+parseTime(_args.trackTimeMax) : parseTime(progress);
						cacheKey = 'timing-'+category+'-'+label;
					}
				}

				if (cacheKey && !_cache[cacheKey]){
					track('send', 'event', 'Reading '+category, 'Reading', label);
					_cache[cacheKey] = true;
				}
			}

			setTimeout(tick, TIMING_DELAY);
		};

		tick();
	};

	function trackHistoryChange (){
		if (!window.history.pushState) return;

		var history  = window.history,
			original = {},
			timeout  = null;

		// add the custom event
		if (!history.hasCustomEvent){
			original.pushState = history.pushState;

			history.pushState = function (){
				if (typeof history.onpushstate == "function") history.onpushstate.apply(history, arguments);
		        return original.pushState.apply(history, arguments);
			};

			history.hasCustomEvent = true;
		}

		// make sure to not erase the previous events
		original.onpushstate 	= history.onpushstate;
		original.onpopstate 	= window.onpopstate;

		history.onpushstate = function (){
			if (typeof original.onpushstate == "function") original.onpushstate.apply(history, arguments);
			void pageview();
		};

		window.onpopstate = function (e){
			if (typeof original.onpopstate == "function") original.onpopstate.apply(window, arguments);
			void pageview();
		};

		function pageview (){
			if (_enabled['historyChange'] === false) return;
			clearTimeout(timeout);
			timeout = setTimeout(_.pageview, 150);
		};
	};

	// EVENTS ------------------------------------------------

	// PUBLIC FUNCTIONS --------------------------------------
	_.set = function (key, value){
		_args[key] = value;
		return _;
	};

	_.enable = function (key){
		if (_enabled[key] === undefined) throw '[Analytics][Error] The "'+key+'" feature doesn\'t exists.';
		_enabled[key] = true;
		return _;
	};

	_.disable = function (key){
		if (_enabled[key] === undefined) throw '[Analytics][Error] The "'+key+'" feature doesn\'t exists.';
		_enabled[key] = false;
		return _;
	};

	_.track = function (category, action, label, args){
		var args = $.extend({
			'repeat'	: true,
			'once'		: false
		}, args || {});

		if (action === undefined){
			label 		= category;
			category 	= 'Custom Tracking';
			action 		= 'Click';
		}else if (label === undefined){
			label  = action;
			action = 'Click';
		}

		var cacheKey 		= 'track-'+category+'-'+action+'-'+label,
			repeatCacheKey 	= 'track-'+category+'-'+action;

		if (!args.repeat && _cache[repeatCacheKey] === label) return;
		if (args.once && _cache[cacheKey]) return;

		track('send', 'event', category, action, label);

		_cache[cacheKey]       = true;
		_cache[repeatCacheKey] = label;

		return _;
	};

	_.trackScroll = function (elements){
		$(elements).each(function (index){
			var element 	= $(this),
				category  	= element.attr('title') || element.attr('name') || element.attr('id') || element.prop('tagName')+index;
			trackScroll(category, element);
		});
		return _;
	};

	_.trackTime = function (elements){
		$(elements).each(function (index){
			var element 	= $(this),
				category  	= element.attr('title') || element.attr('name') || element.attr('id') || element.prop('tagName')+index;
			trackTime(category, element);
		});
		return _;
	};

	_.trackScrollAndTime = function (elements){
		return _.trackScroll(elements).trackTime(elements);
	};

	_.pageview = function (path){
		var path = !path ? window.location.pathname : path;
		track('send', 'pageview', path);
	};

	_.toSource = function (){
		console.log('Analytic cache');
		console.log(_cache);
	};

	return init();
}());
