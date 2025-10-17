export function addCssByLink(url: string): void {
	let doc = document;
	let link = doc.createElement('link');
	link.setAttribute('rel', 'stylesheet');
	link.setAttribute('type', 'text/css');
	link.setAttribute('href', url);

	let heads = doc.getElementsByTagName('head');
	if (heads.length) heads[0].appendChild(link);
	else doc.documentElement.appendChild(link);
}

export function loadJs(url: string, callback?: () => void): void {
	let script = document.createElement('script') as HTMLScriptElement & { readyState?: string; onreadystatechange?: (() => void) | null };
	script.type = 'text/javascript';
	if (typeof callback != 'undefined') {
		if (script.readyState) {
			script.onreadystatechange = function() {
				if (script.readyState == 'loaded' || script.readyState == 'complete') {
					script.onreadystatechange = null;
					callback();
				}
			};
		} else {
			script.onload = function() {
				callback();
			};
		}
	}
	script.src = url;
	document.body.appendChild(script);
}

export function getBrowser(): string {
	let ua = window.navigator.userAgent;
	let isWechat = ua.toLowerCase().match(/MicroMessenger/i)?.[0] === "micromessenger";
	let isIE = (window as any).ActiveXObject != undefined && ua.indexOf('MSIE') != -1;
	let isFirefox = ua.indexOf('Firefox') != -1;
	let isOpera = (window as any).opr != undefined;
	let isChrome = ua.indexOf('Chrome') !== -1 && (window as any).chrome;
	let isSafari = ua.indexOf('Safari') != -1 && ua.indexOf('Version') != -1;
	if (isWechat) {
		return 'Wechat';
	} else if (isIE) {
		return 'IE';
	} else if (isFirefox) {
		return 'Firefox';
	} else if (isOpera) {
		return 'Opera';
	} else if (isChrome) {
		return 'Chrome';
	} else if (isSafari) {
		return 'Safari';
	} else {
		return 'Unknown';
	}
}

export function IsPC(): boolean {
	return ![ 'Android', 'iPhone', 'SymbianOS', 'Windows Phone', 'iPad', 'iPod' ].some(
		(item) => navigator.userAgent.indexOf(item) > 0
	);
}