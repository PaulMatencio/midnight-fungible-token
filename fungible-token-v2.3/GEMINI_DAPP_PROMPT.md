# Midnight Network DApp Frontend Architecture Prompt: FungibleTokenV23.

A Midnight Compact smart contract called **`fungible-token-v2-3`** has been compiled, tested, and prepared for deployment. All relevant contract artifacts including the new adminReallocate circuit, compiled TypeScript definitions, ZKIR circuit bytecodes, client SDK adapters, and deployment configurations are provided in this bundle.

---

## 📦 Bundled Project Artifacts Provided
- `contracts/fungible-token-v2-3.compact`
- `contract/index.d.ts`
- `contract/index.js`
- `contract/index.js.map`
- `zkir/adminReallocate.bzkir`
- `zkir/adminReallocate.zkir`
- `zkir/approve.bzkir`
- `zkir/approve.zkir`
- `zkir/burn.bzkir`
- `zkir/burn.zkir`
- `zkir/emergencyWithdraw.bzkir`
- `zkir/emergencyWithdraw.zkir`
- `zkir/mint.bzkir`
- `zkir/mint.zkir`
- `zkir/pause.bzkir`
- `zkir/pause.zkir`
- `zkir/setEmergencyPauser.bzkir`
- `zkir/setEmergencyPauser.zkir`
- `zkir/transfer.bzkir`
- `zkir/transfer.zkir`
- `zkir/transferFrom.bzkir`
- `zkir/transferFrom.zkir`
- `zkir/unpause.bzkir`
- `zkir/unpause.zkir`
- `sdk/fungible-token-v2-3-sdk.ts`
- `docs/fungible-token-v2-3-sdk.md`
- `examples/fungible-token-v2-3-example.ts`
- `tests/fungible-token-v2-3.test.ts`

###  Here is the commnad to use to get the details of the contact fungible-token-v2-3 deployed on preprod 

curl -s "http://localhost:3001/api/contract/state?address=1f671d56337df583a799cc8657098a1601272e63b89ca706c6894fb8c8e8714b" | jq .

{
  "success": true,
  "data": {
    "contractAddress": "1f671d56337df583a799cc8657098a1601272e63b89ca706c6894fb8c8e8714b",
    "found": true,
    "message": "",
    "raw": {
      "_balances": {},
      "_allowances": {},
      "_totalSupply": "0",
      "_maxSupply": "2000000000000",
      "_name": "ESCALDES TOKEN V2.3",
      "_symbol": "ESCT",
      "_decimals": "6",
      "owner": "a3c24122f1bc023501cbe0edd21a99e2ac09a8072ab3693a450b0689549e5998",
      "_contractSalt": "7fed14431887b8ced99266d0d95e16bffb1e042268aa3dbfcd19b5b807fbdb64",
      "_paused": false,
      "_emergencyPauser": "a3c24122f1bc023501cbe0edd21a99e2ac09a8072ab3693a450b0689549e5998"
    },
    "lastChecked": "2026-09-13T07:18:33.721Z"
  }
}
p


Token Name : ESCALDES TOKEN V2.3
Contract Address : 1f671d56337df583a799cc8657098a1601272e63b89ca706c6894fb8c8e8714b
Token Synbol : ESCT 
Decimal: 6 
Max Supply : 2000000000000
Contract Salt : 7fed14431887b8ced99266d0d95e16bffb1e042268aa3dbfcd19b5b807fbdb64
Owner: a3c24122f1bc023501cbe0edd21a99e2ac09a8072ab3693a450b0689549e5998
 
## 🎯 Primary Goal
 

1. **Add `adminReallocate` to [`useFungibleToken.ts`](file:///home/paul/compact/fungible-token/src/presentation/hooks/useFungibleToken.ts)**: Wire the circuit execution, witness mapping, and owner authentication.
2. **Add the UI Action in [`TokenActions.tsx`](file:///home/paul/compact/fungible-token/src/presentation/components/TokenActions.tsx)**: Create a dedicated "Reallocate / Recover" tab with source account, target spendable account, and amount inputs, restricted to the contract owner.
3. **Connect Activity Logging & 5-Stage Stepper**: Ensure reallocations show full real-time ZK proving, wallet signing, and audit trail records.


### Instructions 
- Update the Fungible-token dApp  to add the new feature  adminReallocate and execute the primary goal and all the features that come with it. 
 

