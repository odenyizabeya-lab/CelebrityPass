import { LANG_ALIASES, LOCALE_AUTO_STORAGE_VALUE, LOCALE_STORAGE_KEY } from "./locales";

/**
 * Renders an inline <script> that resolves the visitor's language BEFORE the
 * first paint. It reads the saved local choice (or the "Automatic / Device
 * Language" sentinel), then the browser's language list, sets
 * <html lang/dir> synchronously (so RTL kicks in before anything renders),
 * and records the resolved code on window for LanguageProvider.
 *
 * The alias table is serialized from the same source as the runtime resolver,
 * so the pre-hydration script can never drift from the actual detection.
 */
export function localeBootstrapScript(): string {
  const aliases = JSON.stringify(LANG_ALIASES);
  return `(function(){try{
var ALIASES=${aliases};
var KEY=${JSON.stringify(LOCALE_STORAGE_KEY)};
var AUTO=${JSON.stringify(LOCALE_AUTO_STORAGE_VALUE)};
function norm(tag){
  var t=String(tag||"").trim().toLowerCase();
  if(!t)return null;
  if(ALIASES[t])return ALIASES[t];
  var base=t.split("-")[0];
  if(base==="zh"){
    var region=(t.split("-")[1]||"").toLowerCase();
    return(region==="tw"||region==="hk"||region==="mo")?"zh-Hant":"zh-Hans";
  }
  return ALIASES[base]||null;
}
var code=null;
try{var saved=window.localStorage.getItem(KEY);if(saved&&saved!==AUTO)code=norm(saved);}catch(e){}
if(!code){
  var langs=[];
  try{langs=(window.navigator.languages&&window.navigator.languages.slice())||[window.navigator.language||"en"];}catch(e){langs=["en"];}
  for(var i=0;i<langs.length;i++){var c=norm(langs[i]);if(c){code=c;break;}}
}
if(!code)code="en";
var rtl=(code==="ar"||code==="he"||code==="ur");
var el=document.documentElement;
el.lang=code;
el.dir=rtl?"rtl":"ltr";
el.setAttribute("dir",rtl?"rtl":"ltr");
try{window.__CP_INITIAL_LOCALE__=code;}catch(e){}
}catch(e){}})();`;
}