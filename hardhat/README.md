# Inkless — Blockchain Layer (Sepolia ETH)

On-chain audit trail for CBSE OSM evaluations. Stores evaluation hash, per-question marks, evaluator ID, final score, and timestamp immutably on Ethereum Sepolia testnet.

---

## Architecture

```
OSM Marking UI (Next.js)
        │
        ▼
  useBlockchain hook  ←─── MetaMask (browser wallet)
        │
        ▼
  InklessAudit.sol  ──────► Sepolia Testnet (chainId: 11155111)
        │
        ▼
  Events + Storage:
    - EvaluationSubmitted (evaluationId, roll, evaluatorId, score, timestamp)
    - EvaluationVerified  (admin second review)
    - MarksDisputed       (student / re-evaluator dispute)
```

---

## What gets stored on-chain

| Field | Type | Description |
|---|---|---|
| `evaluationHash` | `bytes32` | `keccak256(evaluationId + roll + evaluatorId + marks)` — tamper fingerprint |
| `studentRollNumber` | `string` | CBSE roll number |
| `evaluatorId` | `string` | Evaluator's CBSE ID |
| `subject` | `string` | e.g. "Mathematics" |
| `examYear` | `string` | e.g. "2025" |
| `totalMarksAwarded` | `uint16` | Final score |
| `totalMaxMarks` | `uint16` | Max possible |
| `timestamp` | `uint256` | Block timestamp (unix) |
| `verified` | `bool` | Set by admin after second review |
| Per-question marks | `QuestionMark[]` | `{questionCode, marksAwarded, maxMarks, boxColor}` |

---

## Project Structure

```
inkless-blockchain/
├── contracts/
│   └── InklessAudit.sol          ← Solidity contract
├── scripts/
│   └── deploy.js                 ← Hardhat deploy to Sepolia
├── test/
│   └── InklessAudit.test.js      ← Full test suite
├── frontend/
│   ├── lib/
│   │   └── contract.js           ← ABI + contract config
│   ├── hooks/
│   │   └── useBlockchain.js      ← MetaMask + ethers hook
│   └── components/
│       ├── BlockchainSubmit.jsx  ← "Submit to chain" UI card
│       └── AuditVerifier.jsx     ← Lookup + hash verify UI
├── hardhat.config.js
├── .env.example
└── README.md
```

---

## Setup

### 1. Install dependencies

```bash
cd inkless-blockchain
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Fill in SEPOLIA_RPC_URL and PRIVATE_KEY
```

Get a free Sepolia RPC from [Alchemy](https://alchemy.com) or [Infura](https://infura.io)

Get Sepolia ETH (free testnet): [sepoliafaucet.com](https://sepoliafaucet.com)

### 3. Compile contract

```bash
# Using solcjs (already installed)
solcjs --abi --bin --optimize --optimize-runs 200 \
  contracts/InklessAudit.sol --output-dir artifacts/
```

Or via Hardhat (requires compiler download — needs internet):
```bash
npx hardhat compile
```

### 4. Run tests (local)

```bash
npx hardhat test
```

### 5. Deploy to Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Output example:
```
✅ Contract deployed!
   Address  : 0xAbc123...
   Tx Hash  : 0xdef456...
   Explorer : https://sepolia.etherscan.io/address/0xAbc123...

💾 Deployment info saved to: deployments/sepolia.json
📄 ABI saved to            : deployments/InklessAudit.abi.json

Next steps:
  NEXT_PUBLIC_CONTRACT_ADDRESS=0xAbc123...
  NEXT_PUBLIC_CHAIN_ID=11155111
```

### 6. Verify on Etherscan (optional but recommended)

```bash
npx hardhat verify --network sepolia 0xAbc123...
```

### 7. Add to your Next.js app

```bash
# In your Inkless Next.js project
npm install ethers
```

Copy the `frontend/` folder contents into your Next.js project:
```
src/
├── lib/contract.js
├── hooks/useBlockchain.js
└── components/
    ├── BlockchainSubmit.jsx
    └── AuditVerifier.jsx
```

Update `.env.local`:
```env
NEXT_PUBLIC_CONTRACT_ADDRESS=0xAbc123...
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_SEPOLIA_RPC=https://rpc.sepolia.org
```

---

## Usage in your OSM marking page

```jsx
// pages/evaluate/[paperId].jsx

import BlockchainSubmit from "@/components/BlockchainSubmit";

export default function EvaluatePage() {
  // Your existing marking state
  const evaluationData = {
    studentRollNumber: "1234567",
    evaluatorId: "EVL-CBSE-2025-001",
    subject: "Mathematics",
    examYear: "2025",
    questions: [
      { code: "1a",  marksAwarded: 4, maxMarks: 4, boxColor: "green" },
      { code: "1b",  marksAwarded: 3, maxMarks: 4, boxColor: "green" },
      { code: "2",   marksAwarded: 0, maxMarks: 5, boxColor: "red"   },
      { code: "30a", marksAwarded: 6, maxMarks: 6, boxColor: "blue"  },
    ],
    totalMarksAwarded: 13,
    totalMaxMarks: 19,
  };

  return (
    <div>
      {/* your marking UI */}
      
      {/* blockchain commit — drop anywhere on the page */}
      <BlockchainSubmit
        evaluationData={evaluationData}
        onSuccess={(txHash, evaluationId) => {
          console.log("Committed:", txHash, evaluationId);
          // store evaluationId in your MongoDB for cross-reference
        }}
      />
    </div>
  );
}
```

## Audit lookup (student portal / admin)

```jsx
import AuditVerifier from "@/components/AuditVerifier";

export default function AuditPage() {
  return <AuditVerifier />;
}
```

---

## Contract Functions

### Write (evaluator triggers)
| Function | Description |
|---|---|
| `submitEvaluation(...)` | Commits full evaluation; emits `EvaluationSubmitted`; returns `evaluationId` |
| `raiseDispute(id, reason)` | Logs a dispute event; anyone can call |
| `verifyEvaluation(id)` | Admin marks evaluation as second-reviewed |

### Read (free, no gas)
| Function | Returns |
|---|---|
| `getEvaluation(id)` | Full `EvaluationRecord` struct |
| `getQuestionMarks(id)` | Array of `QuestionMark` structs |
| `verifyHash(id)` | `(isValid, storedHash, computedHash)` |
| `getEvaluatorHistory(evaluatorId)` | All `evaluationId`s by that evaluator |
| `getStudentHistory(rollNumber)` | All `evaluationId`s for that student |
| `totalEvaluations()` | Global count |

---

## Security Notes

- Private key is **only in `.env.local`** — never committed (add to `.gitignore`)
- `verifyHash()` provides tamper detection — if the stored keccak256 hash doesn't match the recomputed one, data was altered
- `verified` flag requires contract `owner` — keeps admin second-review separate from evaluator submission
- This is Sepolia **testnet** — switch `CHAIN_ID` to `1` and RPC to mainnet for production

---

## Faucets (get free Sepolia ETH)

- https://sepoliafaucet.com (Alchemy — 0.5 ETH/day)
- https://www.infura.io/faucet/sepolia
- https://faucet.quicknode.com/ethereum/sepolia
