import express from "express";
import dns from "node:dns/promises";
import net from "node:net";
import ipaddr from "ipaddr.js";
import { load } from "cheerio";

const app = express();
app.disable("x-powered-by");
const PORT = Number(process.env.PORT || 8080);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 12000;

app.use((req,res,next) => {
  const origin = req.headers.origin;
  if (origin && FRONTEND_ORIGIN && origin !== FRONTEND_ORIGIN) return res.status(403).json({error:"Origin not allowed"});
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Accept, Content-Type");
  if(req.method==="OPTIONS") return res.sendStatus(204);
  next();
});

function publicIp(ip) {
  try {
    let addr=ipaddr.parse(ip);
    if(addr.kind()==="ipv6" && addr.isIPv4MappedAddress()) addr=addr.toIPv4Address();
    return addr.range()==="unicast";
  } catch { return false; }
}
async function validatePublicHost(hostname) {
  if(!hostname || hostname==="localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) throw new Error("Local hostnames are blocked.");
  if(net.isIP(hostname)) {
    if(!publicIp(hostname)) throw new Error("Private or reserved IP addresses are blocked.");
    return;
  }
  const records=await dns.lookup(hostname,{all:true,verbatim:true});
  if(!records.length || records.some(r=>!publicIp(r.address))) throw new Error("This hostname resolves to a private or reserved address and is blocked.");
}
async function safeFetch(inputUrl, depth=0) {
  if(depth>4) throw new Error("Too many redirects.");
  const url=new URL(inputUrl);
  if(!["http:","https:"].includes(url.protocol)) throw new Error("Only HTTP and HTTPS are supported.");
  if(url.username || url.password) throw new Error("URLs containing credentials are not allowed.");
  await validatePublicHost(url.hostname);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try {
    const response=await fetch(url,{redirect:"manual",signal:controller.signal,headers:{
      "User-Agent":"FaizanProxy/1.0 (+responsible web gateway)",
      "Accept":"text/html,application/xhtml+xml,text/css,text/plain"
    }});
    if([301,302,303,307,308].includes(response.status)) {
      const loc=response.headers.get("location"); if(!loc) throw new Error("Redirect without a location.");
      return await safeFetch(new URL(loc,url).href,depth+1);
    }
    const type=(response.headers.get("content-type")||"").toLowerCase();
    if(!type.includes("text/html") && !type.includes("application/xhtml+xml")) throw new Error("This demo currently displays HTML pages only; received "+(type||"unknown content type")+".");
    const len=Number(response.headers.get("content-length")||0);
    if(len>MAX_BYTES) throw new Error("Page is larger than the 2 MB demo limit.");
    const reader=response.body.getReader();let total=0,chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_BYTES){await reader.cancel();throw new Error("Page exceeded the 2 MB demo limit.");}chunks.push(value);}
    const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
    return {url:url.href,status:response.status,html:new TextDecoder().decode(bytes)};
  } finally { clearTimeout(timer); }
}
app.get("/health",(req,res)=>res.json({ok:true,service:"FAIZAN PROXY",region:"US"}));
app.get("/proxy",async(req,res)=>{
  try{
    const raw=String(req.query.url||"");
    if(!raw || raw.length>2048) return res.status(400).json({error:"Provide a valid URL (maximum 2048 characters)."});
    const result=await safeFetch(raw);
    const $=load(result.html);
    $("base").remove();
    $("head").prepend(`<base href="${result.url.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}">`);
    $("script").remove();
    $("form").removeAttr("action").attr("onsubmit","return false");
    $("a").each((_,el)=>{const href=$(el).attr("href");if(href && !href.startsWith("#") && !/^javascript:/i.test(href)){try{$(el).attr("target","_blank").attr("rel","noopener noreferrer");}catch{}}});
    $("iframe,object,embed").remove();
    $("meta[http-equiv='refresh' i]").remove();
    $("head").append("<meta name=\"referrer\" content=\"no-referrer\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src https: data: blob: 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'\">");
    res.setHeader("Cache-Control","no-store");
    res.json({ok:true,finalUrl:result.url,status:result.status,html:$.html()});
  }catch(err){
    const msg=err.name==="AbortError"?"The destination timed out.":(err.message||"Proxy request failed.");
    res.status(400).json({error:msg});
  }
});
app.listen(PORT,"0.0.0.0",()=>console.log(`FAIZAN PROXY gateway listening on ${PORT}`));
