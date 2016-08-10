'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),
	modernizr = require('modernizr'),
	
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	UrlUtils = require('%PathToCoreWebclientModule%/js/utils/Url.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	Api = require('%PathToCoreWebclientModule%/js/Api.js'),
	Browser = require('%PathToCoreWebclientModule%/js/Browser.js'),
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	Routing = require('%PathToCoreWebclientModule%/js/Routing.js'),
	Screens = require('%PathToCoreWebclientModule%/js/Screens.js'),
	UserSettings = require('%PathToCoreWebclientModule%/js/Settings.js'),
	WindowOpener = require('%PathToCoreWebclientModule%/js/WindowOpener.js')
;

require('%PathToCoreWebclientModule%/js/koBindings.js');
require('%PathToCoreWebclientModule%/js/koExtendings.js');

require('%PathToCoreWebclientModule%/js/enums.js');

require('%PathToCoreWebclientModule%/js/vendors/inputosaurus.js');

require('jquery.cookie');

function InitNotMobileRequires()
{
	require('%PathToCoreWebclientModule%/js/splitter.js'); // necessary in mail and contacts modules
	require('%PathToCoreWebclientModule%/js/CustomTooltip.js');
	require('%PathToCoreWebclientModule%/js/koBindingsNotMobile.js');
}

/**
 * Modernizr build:
 * Method - addTest
 * CSS classes - cssanimations, csstransitions
 */
function InitModernizr()
{
	if (modernizr && navigator)
	{
		modernizr.addTest('pdf', function() {
			return !!_.find(navigator.mimeTypes, function (oMimeType) {
				return 'application/pdf' === oMimeType.type;
			});
		});

		modernizr.addTest('newtab', function() {
			return App.isNewTab();
		});

		modernizr.addTest('mobile', function() {
			return App.isMobile();
		});
		
		if (navigator)
		{
			modernizr.addTest('native-android-browser', function() {
				var ua = navigator.userAgent;
				return (ua.indexOf('Mozilla/5.0') > -1 && ua.indexOf('Android ') > -1 && ua.indexOf('534') > -1 && ua.indexOf('AppleWebKit') > -1);
			});
		}
	}
}

function CApp()
{
	this.iUserRole = window.auroraAppData.User ? window.auroraAppData.User.Role : Enums.UserRole.Anonymous;
	this.sUserName = window.auroraAppData.User ? window.auroraAppData.User.Name : '';
	this.iUserId = window.auroraAppData.User ? window.auroraAppData.User.Id : '';
	this.bPublic = false;
	this.bNewTab = false;
	this.bMobile = false;
}

CApp.prototype.getUserRole = function ()
{
	return this.iUserRole;
};

CApp.prototype.getUserName = function ()
{
	return this.sUserName;
};

CApp.prototype.getUserId = function ()
{
	return this.iUserId;
};

CApp.prototype.setPublic = function ()
{
	this.bPublic = true;
};

CApp.prototype.isPublic = function ()
{
	return this.bPublic;
};

CApp.prototype.setNewTab = function ()
{
	this.bNewTab = true;
};

CApp.prototype.isNewTab = function ()
{
	return this.bNewTab;
};

CApp.prototype.setMobile = function ()
{
	this.bMobile = true;
};

CApp.prototype.isMobile = function ()
{
	return this.bMobile;
};

CApp.prototype.init = function ()
{
	ModulesManager.run('StandardLoginFormWebclient', 'beforeAppRunning', [this.iUserRole !== Enums.UserRole.Anonymous]);
	
	if (Browser.iosDevice && this.iUserRole !== Enums.UserRole.Anonymous && UserSettings.SyncIosAfterLogin && UserSettings.AllowIosProfile)
	{
		window.location.href = '?ios';
	}
	
	if (this.iUserRole !== Enums.UserRole.Anonymous && !this.bPublic)
	{
		var AccountList = ModulesManager.run('Mail', 'getAccountList');
		if (AccountList)
		{
			this.currentAccountId = AccountList.currentId;
			this.defaultAccountId = AccountList.defaultId;
			this.hasAccountWithId = _.bind(AccountList.hasAccountWithId, AccountList);

			this.currentAccountEmail = ko.computed(function () {
				var oAccount = AccountList.getAccount(this.currentAccountId());
				return oAccount ? oAccount.email() : '';
			}, this);

			this.defaultAccount = ko.computed(function () {
				return AccountList.getAccount(this.defaultAccountId());
			}, this);
			this.defaultAccountEmail = ko.computed(function () {
				var oAccount = AccountList.getAccount(this.defaultAccountId());
				return oAccount ? oAccount.email() : '';
			}, this);
			this.defaultAccountFriendlyName = ko.computed(function () {
				var oAccount = AccountList.getAccount(this.defaultAccountId());
				return oAccount ? oAccount.friendlyName() : '';
			}, this);

			this.getAttendee = function (aAttendees) {
				return AccountList.getAttendee(
					_.map(aAttendees, function (mAttendee) {
						return Types.isString(mAttendee) ? mAttendee : mAttendee.email;
					}, this)
				);
			};
		}
		else
		{
			this.currentAccountEmail = _.bind(function () { return this.sUserName; }, this);
			this.defaultAccountEmail = _.bind(function () { return this.sUserName; }, this);
		}
	}
	
	if (!this.bMobile)
	{
		InitNotMobileRequires();
	}
	InitModernizr();
	
	Screens.init();
	Routing.init();
	
	require('%PathToCoreWebclientModule%/js/AppTab.js');
	if (!this.bNewTab)
	{
		require('%PathToCoreWebclientModule%/js/Prefetcher.js');
	}

	this.useGoogleAnalytics();

	if (!this.bMobile)
	{
		$(window).unload(function() {
			WindowOpener.closeAll();
		});
	}
	
	if (Browser.ie8AndBelow)
	{
		$('body').css('overflow', 'hidden');
	}
	
	this.checkCookies();
	
	this.showLastErrorOnLogin();
};

CApp.prototype.showLastErrorOnLogin = function ()
{
	if (this.iUserRole === Enums.UserRole.Anonymous)
	{
		var iError = Types.pInt(UrlUtils.getRequestParam('error'));

		if (iError !== 0)
		{
			Api.showErrorByCode({'ErrorCode': iError, 'ErrorMessage': ''}, '', true);
		}
		
		if (UserSettings.LastErrorCode === Enums.Errors.AuthError)
		{
			Screens.showError(Utils.i18n('%MODULENAME%/ERROR_AUTH_PROBLEM'), false, true);
		}
	}
};

/**
 * @param {number=} iLastErrorCode
 */
CApp.prototype.logout = function (iLastErrorCode)
{
	var Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js');
	
	Ajax.send('Core', 'Logout', iLastErrorCode ? {'LastErrorCode': iLastErrorCode} : null, this.onLogout, this);

	$.removeCookie('AuthToken');
	
	this.iUserRole = Enums.UserRole.Anonymous;
};

CApp.prototype.authProblem = function ()
{
	this.logout(Enums.Errors.AuthError);
};

CApp.prototype.onLogout = function ()
{
	WindowOpener.closeAll();
	
	Routing.finalize();
	
	if (Types.isNonEmptyString(UserSettings.CustomLogoutUrl))
	{
		window.location.href = UserSettings.CustomLogoutUrl;
	}
	else
	{
		UrlUtils.clearAndReloadLocation(Browser.ie8AndBelow, true);
	}
};

CApp.prototype.checkMobile = function () {
	/**
	 * UserSettings.IsMobile:
	 *	-1 - first time, mobile is not determined
	 *	0 - mobile is switched off
	 *	1 - mobile is switched on
	 */
	if (UserSettings.AllowMobile && UserSettings.IsMobile === -1)
	{
		var
			Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
			bMobile = !window.matchMedia('all and (min-width: 768px)').matches
		;

		Ajax.send('Core', 'SetMobile', {'Mobile': bMobile}, function (oResponse) {
			if (bMobile && oResponse.Result)
			{
				window.location.reload();
			}
		}, this);
		
		return true;
	}
	
	return false;
};

CApp.prototype.useGoogleAnalytics = function ()
{
	var
		oGoogleAnalytics = null,
		oFirstScript = null
	;
	
	if (UserSettings.GoogleAnalyticsAccount && 0 < UserSettings.GoogleAnalyticsAccount.length)
	{
		window._gaq = window._gaq || [];
		window._gaq.push(['_setAccount', UserSettings.GoogleAnalyticsAccount]);
		window._gaq.push(['_trackPageview']);

		oGoogleAnalytics = document.createElement('script');
		oGoogleAnalytics.type = 'text/javascript';
		oGoogleAnalytics.async = true;
		oGoogleAnalytics.src = ('https:' === document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
		oFirstScript = document.getElementsByTagName('script')[0];
		oFirstScript.parentNode.insertBefore(oGoogleAnalytics, oFirstScript);
	}
};

/**
 * @returns {Boolean}
 */
CApp.prototype.checkCookies = function ()
{
	$.cookie('checkCookie', '1', { path: '/' });
	var bResult = $.cookie('checkCookie') === '1';
	
	if (!bResult)
	{
		App.Screens.showError(Utils.i18n('%MODULENAME%/ERROR_COOKIES_DISABLED'), false, true);
	}
	else
	{
		$.cookie('AuthToken', $.cookie('AuthToken'), { expires: 30 });
	}

	return bResult;
};

CApp.prototype.getCommonRequestParameters = function ()
{
	var oParameters = {
		AuthToken: $.cookie('AuthToken'),
		TenantName: UserSettings.TenantName,
		Token: UserSettings.CsrfToken
	};
	
	return oParameters;
};

CApp.prototype.broadcastEvent = function (sEventName, oArguments)
{
	if (_.isArray(this.aEventsCallbacks) && _.isArray(this.aEventsCallbacks[sEventName]))
	{
		_.each(this.aEventsCallbacks[sEventName], function (fCallback) {
			fCallback(oArguments);
		});
	}
};

CApp.prototype.subscribeEvent = function (sEventName, fCallback)
{
	if (!_.isArray(this.aEventsCallbacks))
	{
		this.aEventsCallbacks = [];
	}
	
	if (!_.isArray(this.aEventsCallbacks[sEventName]))
	{
		this.aEventsCallbacks[sEventName] = [];
	}
	
	this.aEventsCallbacks[sEventName].push(fCallback);
};

var App = new CApp();

module.exports = App;
