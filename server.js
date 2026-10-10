const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = __dirname, PUBLIC = path.join(ROOT, 'public'), DBFILE = path.join(ROOT, 'database.json');
const PORT = Number(process.env.PORT || 3000);
const sessions = new Map();
const seed = {users:[],products:[
{id:1,name:'Phantom RGB Mouse',category:'Periféricos',price:24990,emoji:'🖱️',description:'Precisión y estilo para tu setup.',stock:12},
{id:2,name:'Neon Mechanical Keyboard',category:'Periféricos',price:39990,emoji:'⌨️',description:'Teclado mecánico con estética RGB.',stock:8},
{id:3,name:'Shadow Pro Headset',category:'Audio',price:32990,emoji:'🎧',description:'Audio inmersivo para tus partidas.',stock:10},
{id:4,name:'Cyber Controller',category:'Accesorios',price:44990,emoji:'🎮',description:'Control cómodo para jugar.',stock:6},
{id:5,name:'Galaxy Mousepad XL',category:'Accesorios',price:14990,emoji:'🌌',description:'Espacio extra para movimientos rápidos.',stock:20},
{id:6,name:'Stream Mic RGB',category:'Audio',price:27990,emoji:'🎙️',description:'Para streaming, juegos y llamadas.',stock:7},
{id:7,name:'Pulse Speakers',category:'Audio',price:21990,emoji:'🔊',description:'Sonido para completar tu estación.',stock:9},
{id:8,name:'Vision Webcam',category:'Accesorios',price:35990,emoji:'📷',description:'Lista para reuniones y streaming.',stock:5}
],orders:[],settings:{storeName:'inj3ct33',accent:'#b026ff',bannerText:'LEVEL UP YOUR REALITY',paymentInstructions:'Métodos de pago: configura aquí tus instrucciones de pago. Esta tienda aún no procesa pagos reales.'}};
function hash(pw,salt=crypto.randomBytes(16).toString('hex')) { return {salt,hash:crypto.scryptSync(pw,salt,64).toString('hex')}; }
function loadDB(){
 if(fs.existsSync(DBFILE)){try{return JSON.parse(fs.readFileSync(DBFILE,'utf8'))}catch{}}
 const db=structuredClone(seed); const admin=hash(process.env.ADMIN_PASSWORD || 'CyberAdmin33!');
 db.users.push({id:1,name:'Administrador',email:'admin@inj3ct33.local',...admin,role:'admin'});
 fs.writeFileSync(DBFILE,JSON.stringify(db,null,2)); return db;
}
let db=loadDB(); db.settings ||= structuredClone(seed.settings); db.products.forEach(p=>{p.imageUrl ||= '';}); db.users.forEach(u=>{if(typeof u.walletBalance!=='number')u.walletBalance=0}); function save(){fs.writeFileSync(DBFILE,JSON.stringify(db,null,2))}
function json(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'null'});res.end(JSON.stringify(obj))}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>1e6)req.destroy()});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch{reject(new Error('JSON inválido'))}});req.on('error',reject)})}
function publicUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role}}
function getUser(req){const sid=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('inj_session='))?.slice(12);const id=sessions.get(sid);return db.users.find(u=>u.id===id)||null}
function requireUser(req,res,admin=false){const u=getUser(req);if(!u){json(res,401,{error:'Inicia sesión primero.'});return null}if(admin&&u.role!=='admin'){json(res,403,{error:'Solo administrador.'});return null}return u}
function safeProduct(p){return {id:p.id,name:p.name,category:p.category,price:p.price,emoji:p.emoji,description:p.description,stock:p.stock,imageUrl:p.imageUrl||''}}
const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end()}
 const url=new URL(req.url,'http://localhost'); const route=url.pathname;
 try{
 if(route.startsWith('/api/')){
  if(route==='/api/products'&&req.method==='GET')return json(res,200,db.products.map(safeProduct));
  if(route==='/api/settings'&&req.method==='GET')return json(res,200,db.settings);
  if(route==='/api/me'&&req.method==='GET'){const u=getUser(req);return json(res,200,{user:u?publicUser(u):null})}
  if(route==='/api/register'&&req.method==='POST'){const b=await readBody(req);const name=String(b.name||'').trim(),email=String(b.email||'').trim().toLowerCase(),pw=String(b.password||'');if(name.length<2||!email.includes('@')||pw.length<8)return json(res,400,{error:'Nombre, correo válido y contraseña de 8 caracteres mínimo.'});if(db.users.some(u=>u.email===email))return json(res,409,{error:'Ese correo ya está registrado.'});const h=hash(pw),u={id:Math.max(0,...db.users.map(x=>x.id))+1,name,email,...h,role:'user'};db.users.push(u);save();const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,u.id);res.setHeader('Set-Cookie',`inj_session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);return json(res,201,{user:publicUser(u)})}
  if(route==='/api/login'&&req.method==='POST'){const b=await readBody(req),email=String(b.email||'').trim().toLowerCase(),pw=String(b.password||''),u=db.users.find(x=>x.email===email);if(!u||!crypto.timingSafeEqual(Buffer.from(hash(pw,u.salt).hash,'hex'),Buffer.from(u.hash,'hex')))return json(res,401,{error:'Correo o contraseña incorrectos.'});const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,u.id);res.setHeader('Set-Cookie',`inj_session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);return json(res,200,{user:publicUser(u)})}
  if(route==='/api/logout'&&req.method==='POST'){const sid=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('inj_session='))?.slice(12);if(sid)sessions.delete(sid);res.setHeader('Set-Cookie','inj_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return json(res,200,{ok:true})}
  if(route==='/api/orders'&&req.method==='POST'){const u=requireUser(req,res);if(!u)return;const b=await readBody(req);if(!Array.isArray(b.items)||!b.items.length)return json(res,400,{error:'El carrito está vacío.'});let total=0,lines=[];for(const it of b.items){const p=db.products.find(x=>x.id===Number(it.id)),q=Math.floor(Number(it.quantity));if(!p||!Number.isInteger(q)||q<1||q>99)return json(res,400,{error:'Producto o cantidad inválidos.'});if(p.stock<q)return json(res,409,{error:`Stock insuficiente para ${p.name}.`});total+=p.price*q;lines.push({productId:p.id,name:p.name,price:p.price,quantity:q});}for(const l of lines)db.products.find(p=>p.id===l.productId).stock-=l.quantity;const order={id:crypto.randomUUID(),userId:u.id,email:u.email,items:lines,total,status:'Recibido',createdAt:new Date().toISOString()};db.orders.push(order);save();return json(res,201,{order:{id:order.id,total:order.total,status:order.status}})}
  if(route==='/api/admin/settings'&&req.method==='PUT'){if(!requireUser(req,res,true))return;const b=await readBody(req);db.settings={storeName:String(b.storeName||'inj3ct33').trim().slice(0,40),accent:/^#[0-9a-fA-F]{6}$/.test(b.accent)?b.accent:'#b026ff',bannerText:String(b.bannerText||'LEVEL UP YOUR REALITY').trim().slice(0,100),paymentInstructions:String(b.paymentInstructions||'').trim().slice(0,1000)};save();return json(res,200,db.settings)}
  if(route==='/api/admin/summary'&&req.method==='GET'){if(!requireUser(req,res,true))return;return json(res,200,{users:db.users.length,products:db.products.length,orders:db.orders.length,revenue:db.orders.reduce((s,o)=>s+o.total,0),orders:db.orders.slice().reverse()})}
  if(route==='/api/admin/products'&&req.method==='POST'){if(!requireUser(req,res,true))return;const b=await readBody(req),p=validateProduct(b);if(p.error)return json(res,400,{error:p.error});p.id=Math.max(0,...db.products.map(x=>x.id))+1;db.products.push(p);save();return json(res,201,safeProduct(p))}
  const productRoute=route.match(/^\/api\/admin\/products\/(\d+)$/);
  if(productRoute&&req.method==='PUT'){if(!requireUser(req,res,true))return;const p=db.products.find(x=>x.id===Number(productRoute[1]));if(!p)return json(res,404,{error:'Producto no encontrado.'});const b=await readBody(req),v=validateProduct(b);if(v.error)return json(res,400,{error:v.error});Object.assign(p,v,{id:p.id});save();return json(res,200,safeProduct(p))}
  if(productRoute&&req.method==='DELETE'){if(!requireUser(req,res,true))return;db.products=db.products.filter(x=>x.id!==Number(productRoute[1]));save();return json(res,200,{ok:true})}
  return json(res,404,{error:'Ruta API no encontrada.'});
 }
 const file=route==='/'?'index.html':path.normalize(route).replace(/^([/\\]|\.\.(?:[/\\]|$))+/,'');const full=path.join(PUBLIC,file);if(!full.startsWith(PUBLIC))return json(res,403,{error:'No permitido'});fs.readFile(full,(err,data)=>{if(err){res.writeHead(404);return res.end('No encontrado')}const ext=path.extname(full);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'}[ext]||'application/octet-stream')});res.end(data)});
 }catch(e){console.error(e);json(res,500,{error:'Error interno del servidor.'})}
});
function validateProduct(b){const name=String(b.name||'').trim(),category=String(b.category||'Accesorios').trim(),price=Number(b.price),stock=Number(b.stock??0),emoji=String(b.emoji||'🎮').slice(0,8),description=String(b.description||'').trim(),imageUrl=String(b.imageUrl||'').trim().slice(0,1500);if(name.length<2||!Number.isFinite(price)||price<1||!Number.isInteger(stock)||stock<0)return {error:'Nombre, precio positivo y stock entero válido requeridos.'};if(imageUrl&&!/^https:\/\//i.test(imageUrl))return {error:'La foto debe ser una URL https:// válida.'};return {name,category,price:Math.round(price),stock,emoji,description,imageUrl}}
server.listen(PORT,'0.0.0.0',()=>console.log(`\ninj3ct33 activo: http://localhost:${PORT}\nBase de datos: database.json\n`));
