import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { inventoryFecBulk, parseInventoryArgs } from "./inventory-fec-bulk";
describe("inventory FEC bulk",()=>{
 it("groups duplicate hashes including numbered copies and classifies prohibited files",async()=>{const root=await mkdtemp(join(tmpdir(),"fec-inventory-"));try{await Promise.all([writeFile(join(root,"oth16.zip"),"x"),writeFile(join(root,"oth16 (1).zip"),"x"),writeFile(join(root,"cn26.zip"),"y")]);const rows=inventoryFecBulk(root);expect(rows.filter(x=>x.duplicateHashGroup).map(x=>x.filename)).toEqual(["oth16 (1).zip","oth16.zip"]);expect(rows[0]?.classification).toBe("bootstrap_candidate");expect(rows[1]?.classification).toBe("prohibited_unopened");}finally{await rm(root,{recursive:true,force:true});}});
 it("rejects symlinks and unsafe basenames",async()=>{const root=await mkdtemp(join(tmpdir(),"fec-inventory-"));try{await writeFile(join(root,"cn26.zip"),"x");await symlink(join(root,"cn26.zip"),join(root,"cm26.zip"));expect(()=>inventoryFecBulk(root)).toThrow("FEC_INVENTORY_FILE_INVALID");await rm(join(root,"cm26.zip"));await writeFile(join(root,"-bad.zip"),"x");expect(()=>inventoryFecBulk(root)).toThrow("FEC_INVENTORY_NAME_INVALID");}finally{await rm(root,{recursive:true,force:true});}});
 it("parses only the root CLI option",()=>{expect(parseInventoryArgs(["--root","x"])).toBe("x");expect(()=>parseInventoryArgs([])).toThrow("Require --root");});
});
