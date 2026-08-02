import {createPublicClient,http,formatUnits,formatEther} from 'viem';
import {base} from 'viem/chains';
import fs from 'fs';
const H=process.env.HOME+'/Documents/gblin/Altro/lista-outreach-2026-08/';
const band=JSON.parse(fs.readFileSync(H+'step3_band.json')).sort((a,b)=>b.blk-a.blk).slice(0,700);
const RPCS=['https://mainnet.base.org','https://base-rpc.publicnode.com','https://base.drpc.org'];
let ci=0; const cl=()=>createPublicClient({chain:base,transport:http(RPCS[ci%RPCS.length],{retryCount:2,timeout:25000})});
const senders={};
for(let i=0;i<band.length;i+=25){
  const g=band.slice(i,i+25);
  await Promise.all(g.map(async x=>{
    for(let a=0;a<3;a++){
      try{ const t=await cl().getTransaction({hash:x.tx});
        const f=t.from.toLowerCase();
        senders[f]=senders[f]||{n:0,usd:0};
        senders[f].n++; senders[f].usd+=x.usd; return;
      }catch(e){ ci++; }
    }
  }));
  process.stderr.write('.');
}
const uniq=Object.entries(senders).map(([a,v])=>({a,...v})).sort((x,y)=>y.usd-x.usd);
console.log('\ntx risolte:',band.length,'| firmatari unici:',uniq.length);
fs.writeFileSync(H+'step4_senders.json',JSON.stringify(uniq,null,1));
// profilo: EOA? nonce? tiene anche USDC ed ETH?
const CB='0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',US='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const erc=[{name:'balanceOf',type:'function',stateMutability:'view',inputs:[{type:'address'}],outputs:[{type:'uint256'}]}];
const prof=[];
for(let i=0;i<uniq.length;i+=20){
  const g=uniq.slice(i,i+20);
  const r=await Promise.all(g.map(async u=>{
    for(let a=0;a<3;a++){
      try{ const c=cl();
        const [code,nonce,eth,cb,us]=await Promise.all([
          c.getCode({address:u.a}), c.getTransactionCount({address:u.a}), c.getBalance({address:u.a}),
          c.readContract({address:CB,abi:erc,functionName:'balanceOf',args:[u.a]}),
          c.readContract({address:US,abi:erc,functionName:'balanceOf',args:[u.a]}),
        ]);
        return {...u, contratto: !!(code&&code!=='0x'), nonce,
          ethUsd:Number(formatEther(eth))*1900, cbUsd:Number(formatUnits(cb,8))*64600, usdc:Number(formatUnits(us,6))};
      }catch(e){ ci++; }
    }
    return null;
  }));
  prof.push(...r.filter(Boolean)); process.stderr.write('+');
}
fs.writeFileSync(H+'step5_profili.json',JSON.stringify(prof,null,1));
const persone=prof.filter(p=>!p.contratto && p.nonce<20000);
const basket=persone.filter(p=>p.cbUsd>300 && p.usdc>300 && p.ethUsd>50);
console.log('\nprofilati:',prof.length,'| persone (EOA, nonce<20k):',persone.length,'| di cui tengono cbBTC+USDC+ETH:',basket.length);
fs.writeFileSync(H+'step6_target.json',JSON.stringify(basket.sort((a,b)=>b.usd-a.usd),null,1));
