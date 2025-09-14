# VoiceVoteAccess: Accessible Voice-Activated Blockchain Voting System

## Overview

VoiceVoteAccess is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It provides a voice-activated voting interface designed to enhance accessibility for individuals with disabilities, such as visual impairments or mobility challenges. The system links voice commands to secure blockchain-based voting, ensuring privacy, transparency, and immutability. Votes are recorded on-chain, preventing tampering and allowing verifiable audits.

This project solves real-world problems in democratic processes:
- **Accessibility Barriers**: Traditional voting systems (physical booths or digital interfaces) often exclude people with disabilities. Voice activation allows hands-free interaction.
- **Voter Fraud and Trust Issues**: Blockchain ensures votes are tamper-proof and countable without central authorities.
- **Low Participation**: By making voting easier and more inclusive, it boosts turnout among underserved populations.
- **Auditability**: Publicly verifiable results reduce disputes in elections, referendums, or DAO governance.

The frontend (not included here) would use Web3 libraries to interact with Stacks wallets and integrate speech-to-text APIs (e.g., Web Speech API) for voice commands. The blockchain layer handles secure vote storage and tallying.

## Tech Stack
- **Blockchain**: Stacks (Bitcoin-secured layer).
- **Smart Contract Language**: Clarity (secure, predictable, and analyzable).
- **Contracts**: 6 core smart contracts for modularity and security.
- **Deployment**: Use Stacks CLI for deployment to testnet/mainnet.
- **Frontend Integration**: JavaScript with @stacks/connect for wallet interactions and voice processing.

## Architecture
1. **User Registration**: Voters register identities on-chain.
2. **Election Setup**: Admins create elections with options.
3. **Voice-Activated Voting**: Off-chain voice interface translates commands to on-chain transactions.
4. **Vote Submission**: Encrypted votes stored on-chain.
5. **Tally and Results**: Post-election reveal and computation.
6. **Auditing**: Immutable logs for verification.

The system assumes voice verification happens off-chain (e.g., via biometric hashing) to comply with privacy, with hashes stored on-chain for integrity checks.

## Smart Contracts
The project uses 6 solid Clarity smart contracts. Each is designed for a specific role, minimizing attack surfaces. Code is provided below as snippets; full files would be in separate `.clar` files.

### 1. VoterRegistry.clar
Manages voter registration and identity verification. Stores hashed voice biometrics or wallet addresses to prevent double-voting.

```clarity
;; VoterRegistry.clar
(define-constant ERR-ALREADY-REGISTERED (err u100))
(define-constant ERR-NOT-AUTHORIZED (err u101))

(define-map voters principal { registered: bool, voice-hash: (buff 32) })

(define-public (register-voter (voice-hash (buff 32)))
  (let ((caller tx-sender))
    (match (map-get? voters caller)
      entry (if (get registered entry) ERR-ALREADY-REGISTERED (ok true))
      (map-set voters caller { registered: true, voice-hash: voice-hash })
      (ok true))))

(define-read-only (is-registered (voter principal))
  (default-to false (get registered (map-get? voters voter))))
```

### 2. ElectionFactory.clar
Allows authorized admins to create new elections, defining parameters like start/end times, options, and accessibility flags (e.g., voice-only mode).

```clarity
;; ElectionFactory.clar
(define-constant ERR-INVALID-PARAMS (err u200))
(define-constant ERR-NOT-ADMIN (err u201))

(define-data-var admin principal tx-sender)
(define-map elections uint { start: uint, end: uint, options: (list 10 (string-ascii 50)), voice-enabled: bool })

(define-public (create-election (id uint) (start uint) (end uint) (options (list 10 (string-ascii 50))) (voice-enabled bool))
  (if (is-eq tx-sender (var-get admin))
    (begin
      (if (or (<= end start) (is-none (index-of options (as-max-len? options u1)))) ERR-INVALID-PARAMS (ok true))
      (map-set elections id { start: start, end: end, options: options, voice-enabled: voice-enabled })
      (ok id))
    ERR-NOT-ADMIN))
```

### 3. Ballot.clar
Defines the ballot structure and handles option validation for votes.

```clarity
;; Ballot.clar
(define-constant ERR-INVALID-OPTION (err u300))

(define-public (validate-option (election-id uint) (option (string-ascii 50)))
  (match (map-get? elections election-id)
    election (if (is-some (index-of? (get options election) option)) (ok true) ERR-INVALID-OPTION)
    ERR-INVALID-PARAMS))
```

### 4. Voting.clar
Core contract for submitting votes. Uses blinded commitments for privacy (votes are hashed until reveal phase).

```clarity
;; Voting.clar
(define-constant ERR-NOT-REGISTERED (err u400))
(define-constant ERR-VOTING-CLOSED (err u401))
(define-constant ERR-ALREADY-VOTED (err u402))

(define-map votes { election-id: uint, voter: principal } { commitment: (buff 32), revealed: bool })
(define-map voted principal (list 10 uint)) ;; Tracks elections voted in

(define-public (submit-vote (election-id uint) (commitment (buff 32)))
  (let ((caller tx-sender) (now block-height))
    (if (not (is-registered caller)) ERR-NOT-REGISTERED
      (match (map-get? elections election-id)
        election (if (or (< now (get start election)) (> now (get end election))) ERR-VOTING-CLOSED
          (if (is-some (index-of? (map-get? voted caller) election-id)) ERR-ALREADY-VOTED
            (begin
              (map-set votes { election-id: election-id, voter: caller } { commitment: commitment, revealed: false })
              (map-set voted caller (append (default-to (list) (map-get? voted caller)) election-id))
              (ok true))))
        ERR-INVALID-PARAMS))))
```

### 5. RevealAndTally.clar
Handles vote revelation after voting closes and tallies results securely.

```clarity
;; RevealAndTally.clar
(define-constant ERR-NOT-REVEAL-PHASE (err u500))
(define-constant ERR-INVALID-REVEAL (err u501))

(define-map tallies uint (map (string-ascii 50) uint))

(define-public (reveal-vote (election-id uint) (option (string-ascii 50)) (salt (buff 32)))
  (let ((caller tx-sender) (now block-height))
    (match (map-get? elections election-id)
      election (if (<= now (get end election)) ERR-NOT-REVEAL-PHASE
        (match (map-get? votes { election-id: election-id, voter: caller })
          vote (if (get revealed vote) ERR-ALREADY-VOTED
            (if (is-eq (keccak256 (concat option salt)) (get commitment vote))
              (begin
                (map-set votes { election-id: election-id, voter: caller } { commitment: (get commitment vote), revealed: true })
                (let ((current-tally (default-to u0 (map-get? tallies election-id option))))
                  (map-set tallies election-id { option: (+ current-tally u1) })
                  (ok true))
              ERR-INVALID-REVEAL))
          ERR-NOT-AUTHORIZED))
      ERR-INVALID-PARAMS)))

(define-read-only (get-tally (election-id uint) (option (string-ascii 50)))
  (default-to u0 (map-get? tallies election-id option)))
```

### 6. AuditLog.clar
Logs all actions for transparency and auditing, emitting events for off-chain monitoring.

```clarity
;; AuditLog.clar
(define-constant ERR-LOG-FAIL (err u600))

(define-map logs uint { action: (string-ascii 100), actor: principal, timestamp: uint })

(define-data-var log-counter uint u0)

(define-public (log-action (action (string-ascii 100)))
  (let ((id (var-get log-counter)))
    (map-set logs id { action: action, actor: tx-sender, timestamp: block-height })
    (var-set log-counter (+ id u1))
    (ok id)))

(define-read-only (get-log (id uint))
  (map-get? logs id))
```

## Installation and Deployment
1. Install Stacks CLI: `npm install -g @stacks/cli`.
2. Clone repo: `git clone <repo-url>`.
3. Deploy contracts: Use `stacks deploy` for each `.clar` file.
4. Test: Use Stacks testnet and Clarity's built-in testing framework (e.g., `(contract-call? ...)` in REPL).

## Usage
- Register: Call `register-voter` with voice hash.
- Create Election: Admin calls `create-election`.
- Vote: Voice interface generates commitment, calls `submit-vote`.
- Reveal: Post-election, call `reveal-vote`.
- Tally: Query `get-tally`.
- Audit: Fetch logs.

## Security Considerations
- Clarity's decidability prevents reentrancy and overflows.
- Use blinded votes for privacy.
- Assume off-chain voice auth to avoid on-chain biometrics.

## Future Enhancements
- Integrate with STX tokens for incentivized voting.
- Add DAO governance for admin changes.
- Mobile app for voice interface.

## License
MIT License. See LICENSE file for details.