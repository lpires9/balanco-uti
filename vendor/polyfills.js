// Polyfills para navegadores antigos (ex: Cent Browser / Chromium 86): Array/TypedArray/String.at, findLast, Object.hasOwn.
(function(g){
function at(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return(n<0||n>=this.length)?undefined:this[n];}
var T=[Array,String,Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array];
if(typeof BigInt64Array!=="undefined")T.push(BigInt64Array,BigUint64Array);
T.forEach(function(C){if(!C.prototype.at)Object.defineProperty(C.prototype,"at",{value:at,writable:true,configurable:true});});
if(!Array.prototype.findLast){Object.defineProperty(Array.prototype,"findLast",{value:function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return this[i];},writable:true,configurable:true});
Object.defineProperty(Array.prototype,"findLastIndex",{value:function(f,t){for(var i=this.length-1;i>=0;i--)if(f.call(t,this[i],i,this))return i;return -1;},writable:true,configurable:true});}
if(!Object.hasOwn)Object.hasOwn=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
})(typeof self!=="undefined"?self:this);
