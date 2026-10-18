import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
await fs.mkdir('docs/sample',{recursive:true});const browser=await chromium.launch({channel:process.platform==='win32'?'msedge':undefined});
try{for(const [name,url,button] of [['before','http://127.0.0.1:4175/gold-miner-storybook/','开始挖矿 →'],['after','http://127.0.0.1:4176/sample.html','开始样片']]){
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();await page.goto(url);await page.getByRole('button',{name:button,exact:true}).click();await page.waitForTimeout(150);await page.screenshot({path:`docs/sample/${name}.png`,fullPage:false});await context.close();}}
finally{await browser.close();}
