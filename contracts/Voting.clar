;; VotingSystem.clar

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-MAX-VOTERS u101)
(define-constant ERR-INVALID-VOTE-OPTIONS u102)
(define-constant ERR-INVALID-ELECTION-DUR u103)
(define-constant ERR-INVALID-QUORUM u104)
(define-constant ERR-INVALID-THRESHOLD u105)
(define-constant ERR-ELECTION-ALREADY-EXISTS u106)
(define-constant ERR-ELECTION-NOT-FOUND u107)
(define-constant ERR-INVALID-TIMESTAMP u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-MIN-VOTES u110)
(define-constant ERR-INVALID-MAX-VOTES u111)
(define-constant ERR-ELECTION-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-ELECTIONS-EXCEEDED u114)
(define-constant ERR-INVALID-ELECTION-TYPE u115)
(define-constant ERR-INVALID-ANONYMITY-LEVEL u116)
(define-constant ERR-INVALID-REVEAL-PERIOD u117)
(define-constant ERR-INVALID-JURISDICTION u118)
(define-constant ERR-INVALID-VOTE-CURRENCY u119)
(define-constant ERR-INVALID-STATUS u120)
(define-constant ERR-NOT-REGISTERED u121)
(define-constant ERR-ALREADY-VOTED u122)
(define-constant ERR-VOTING-CLOSED u123)
(define-constant ERR-INVALID-COMMITMENT u124)
(define-constant ERR-REVEAL-FAILED u125)
(define-constant ERR-QUORUM-NOT-MET u126)
(define-constant ERR-INVALID-DELEGATE u127)

(define-data-var next-election-id uint u0)
(define-data-var max-elections uint u500)
(define-data-var creation-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map elections
  uint
  {
    name: (string-utf8 100),
    max-voters: uint,
    options: (list 10 (string-utf8 50)),
    duration: uint,
    quorum: uint,
    threshold: uint,
    timestamp: uint,
    creator: principal,
    election-type: (string-utf8 50),
    anonymity-level: uint,
    reveal-period: uint,
    jurisdiction: (string-utf8 100),
    vote-currency: (string-utf8 20),
    status: bool,
    min-votes: uint,
    max-votes: uint
  }
)

(define-map elections-by-name
  (string-utf8 100)
  uint)

(define-map election-updates
  uint
  {
    update-name: (string-utf8 100),
    update-max-voters: uint,
    update-options: (list 10 (string-utf8 50)),
    update-timestamp: uint,
    updater: principal
  }
)

(define-map voters
  principal
  {
    registered: bool,
    voice-hash: (buff 32),
    delegated-to: (optional principal)
  }
)

(define-map votes
  { election-id: uint, voter: principal }
  {
    commitment: (buff 32),
    revealed: bool,
    option: (optional (string-utf8 50)),
    salt: (optional (buff 32))
  }
)

(define-map voted
  principal
  (list 10 uint)
)

(define-map tallies
  { election-id: uint, option: (string-utf8 50) }
  uint
)

(define-read-only (get-election (id uint))
  (map-get? elections id)
)

(define-read-only (get-election-updates (id uint))
  (map-get? election-updates id)
)

(define-read-only (is-election-registered (name (string-utf8 100)))
  (is-some (map-get? elections-by-name name))
)

(define-read-only (is-voter-registered (voter principal))
  (match (map-get? voters voter)
    voter-entry (get registered voter-entry)
    false
  )
)

(define-read-only (get-vote (election-id uint) (voter principal))
  (map-get? votes { election-id: election-id, voter: voter })
)

(define-read-only (get-tally (election-id uint) (option (string-utf8 50)))
  (default-to u0 (map-get? tallies { election-id: election-id, option: option }))
)

(define-read-only (get-voted-elections (voter principal))
  (map-get? voted voter)
)

(define-private (validate-name (name (string-utf8 100)))
  (if (and (> (len name) u0) (<= (len name) u100))
      (ok true)
      (err ERR-INVALID-UPDATE-PARAM))
)

(define-private (validate-max-voters (voters uint))
  (if (and (> voters u0) (<= voters u1000))
      (ok true)
      (err ERR-INVALID-MAX-VOTERS))
)

(define-private (validate-options (opts (list 10 (string-utf8 50))))
  (if (and (> (len opts) u1) (<= (len opts) u10))
      (ok true)
      (err ERR-INVALID-VOTE-OPTIONS))
)

(define-private (validate-duration (dur uint))
  (if (> dur u0)
      (ok true)
      (err ERR-INVALID-ELECTION-DUR))
)

(define-private (validate-quorum (q uint))
  (if (<= q u100)
      (ok true)
      (err ERR-INVALID-QUORUM))
)

(define-private (validate-threshold (t uint))
  (if (and (> t u0) (<= t u100))
      (ok true)
      (err ERR-INVALID-THRESHOLD))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-election-type (typ (string-utf8 50)))
  (if (or (is-eq typ "public") (is-eq typ "private") (is-eq typ "dao"))
      (ok true)
      (err ERR-INVALID-ELECTION-TYPE))
)

(define-private (validate-anonymity-level (level uint))
  (if (<= level u3)
      (ok true)
      (err ERR-INVALID-ANONYMITY-LEVEL))
)

(define-private (validate-reveal-period (period uint))
  (if (<= period u60)
      (ok true)
      (err ERR-INVALID-REVEAL-PERIOD))
)

(define-private (validate-jurisdiction (jur (string-utf8 100)))
  (if (and (> (len jur) u0) (<= (len jur) u100))
      (ok true)
      (err ERR-INVALID-JURISDICTION))
)

(define-private (validate-vote-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "sBTC"))
      (ok true)
      (err ERR-INVALID-VOTE-CURRENCY))
)

(define-private (validate-min-votes (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-VOTES))
)

(define-private (validate-max-votes (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-VOTES))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-private (validate-commitment (commit (buff 32)) (option (string-utf8 50)) (salt (buff 32)))
  (if (is-eq commit (sha256 (concat (string-ascii option) salt)))
      (ok true)
      (err ERR-INVALID-COMMITMENT))
)

(define-private (check-quorum (election-id uint) (total-votes uint))
  (let ((election (unwrap! (map-get? elections election-id) (err ERR-ELECTION-NOT-FOUND)))
       (q (get quorum election)))
    (if (>= total-votes (/ (* (get max-voters election) q) u100))
        (ok true)
        (err ERR-QUORUM-NOT-MET))
  )
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-elections (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-MAX-VOTES))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-elections new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (register-voter (voice-hash (buff 32)))
  (let ((caller tx-sender))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (not (is-voter-registered caller)) (err ERR-NOT-REGISTERED))
    (map-set voters caller
      {
        registered: true,
        voice-hash: voice-hash,
        delegated-to: none
      }
    )
    (ok true)
  )
)

(define-public (delegate-vote (to principal))
  (let ((caller tx-sender))
    (asserts! (is-voter-registered caller) (err ERR-NOT-REGISTERED))
    (asserts! (is-voter-registered to) (err ERR-INVALID-DELEGATE))
    (let ((voter-entry (unwrap! (map-get? voters caller) (err ERR-NOT-REGISTERED))))
      (map-set voters caller
        {
          registered: (get registered voter-entry),
          voice-hash: (get voice-hash voter-entry),
          delegated-to: (some to)
        }
      )
      (ok true)
    )
  )
)

(define-public (create-election
  (election-name (string-utf8 100))
  (max-voters uint)
  (options (list 10 (string-utf8 50)))
  (duration uint)
  (quorum uint)
  (threshold uint)
  (election-type (string-utf8 50))
  (anonymity-level uint)
  (reveal-period uint)
  (jurisdiction (string-utf8 100))
  (vote-currency (string-utf8 20))
  (min-votes uint)
  (max-votes uint)
)
  (let (
        (next-id (var-get next-election-id))
        (current-max (var-get max-elections))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-ELECTIONS-EXCEEDED))
    (try! (validate-name election-name))
    (try! (validate-max-voters max-voters))
    (try! (validate-options options))
    (try! (validate-duration duration))
    (try! (validate-quorum quorum))
    (try! (validate-threshold threshold))
    (try! (validate-election-type election-type))
    (try! (validate-anonymity-level anonymity-level))
    (try! (validate-reveal-period reveal-period))
    (try! (validate-jurisdiction jurisdiction))
    (try! (validate-vote-currency vote-currency))
    (try! (validate-min-votes min-votes))
    (try! (validate-max-votes max-votes))
    (asserts! (is-none (map-get? elections-by-name election-name)) (err ERR-ELECTION-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender authority-recipient))
    )
    (map-set elections next-id
      {
        name: election-name,
        max-voters: max-voters,
        options: options,
        duration: duration,
        quorum: quorum,
        threshold: threshold,
        timestamp: block-height,
        creator: tx-sender,
        election-type: election-type,
        anonymity-level: anonymity-level,
        reveal-period: reveal-period,
        jurisdiction: jurisdiction,
        vote-currency: vote-currency,
        status: true,
        min-votes: min-votes,
        max-votes: max-votes
      }
    )
    (map-set elections-by-name election-name next-id)
    (var-set next-election-id (+ next-id u1))
    (print { event: "election-created", id: next-id })
    (ok next-id)
  )
)

(define-public (update-election
  (election-id uint)
  (update-name (string-utf8 100))
  (update-max-voters uint)
  (update-options (list 10 (string-utf8 50)))
)
  (let ((election (map-get? elections election-id)))
    (match election
      e
        (begin
          (asserts! (is-eq (get creator e) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-name update-name))
          (try! (validate-max-voters update-max-voters))
          (try! (validate-options update-options))
          (let ((existing (map-get? elections-by-name update-name)))
            (match existing
              existing-id
                (asserts! (is-eq existing-id election-id) (err ERR-ELECTION-ALREADY-EXISTS))
              true
            )
          )
          (let ((old-name (get name e)))
            (if (is-eq old-name update-name)
                true
                (begin
                  (map-delete elections-by-name old-name)
                  (map-set elections-by-name update-name election-id)
                  true
                )
            )
          )
          (map-set elections election-id
            {
              name: update-name,
              max-voters: update-max-voters,
              options: update-options,
              duration: (get duration e),
              quorum: (get quorum e),
              threshold: (get threshold e),
              timestamp: block-height,
              creator: (get creator e),
              election-type: (get election-type e),
              anonymity-level: (get anonymity-level e),
              reveal-period: (get reveal-period e),
              jurisdiction: (get jurisdiction e),
              vote-currency: (get vote-currency e),
              status: (get status e),
              min-votes: (get min-votes e),
              max-votes: (get max-votes e)
            }
          )
          (map-set election-updates election-id
            {
              update-name: update-name,
              update-max-voters: update-max-voters,
              update-options: update-options,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "election-updated", id: election-id })
          (ok true)
        )
      (err ERR-ELECTION-NOT-FOUND)
    )
  )
)

(define-public (submit-vote (election-id uint) (commitment (buff 32)))
  (let ((caller tx-sender) (now block-height))
    (asserts! (is-voter-registered caller) (err ERR-NOT-REGISTERED))
    (let ((election (unwrap! (map-get? elections election-id) (err ERR-ELECTION-NOT-FOUND))))
      (asserts! (get status election) (err ERR-VOTING-CLOSED))
      (asserts! (and (>= now (get timestamp election)) (<= now (+ (get timestamp election) (get duration election)))) (err ERR-VOTING-CLOSED))
      (asserts! (is-none (index-of (get voted-elections caller) election-id)) (err ERR-ALREADY-VOTED))
      (map-set votes { election-id: election-id, voter: caller }
        {
          commitment: commitment,
          revealed: false,
          option: none,
          salt: none
        }
      )
      (map-set voted caller (append (default-to (list) (get-voted-elections caller)) election-id))
      (ok true)
    )
  )
)

(define-public (reveal-vote (election-id uint) (option (string-utf8 50)) (salt (buff 32)))
  (let ((caller tx-sender) (now block-height))
    (let ((election (unwrap! (map-get? elections election-id) (err ERR-ELECTION-NOT-FOUND)))
         (vote-entry (unwrap! (map-get? votes { election-id: election-id, voter: caller }) (err ERR-NOT-REGISTERED))))
      (asserts! (not (get revealed vote-entry)) (err ERR-ALREADY-VOTED))
      (try! (validate-commitment (get commitment vote-entry) option salt))
      (asserts! (is-some (index-of (get options election) option)) (err ERR-INVALID-COMMITMENT))
      (asserts! (> now (+ (get timestamp election) (get duration election))) (err ERR-REVEAL-FAILED))
      (map-set votes { election-id: election-id, voter: caller }
        {
          commitment: (get commitment vote-entry),
          revealed: true,
          option: (some option),
          salt: (some salt)
        }
      )
      (let ((current-tally (default-to u0 (get-tally election-id option))))
        (map-set tallies { election-id: election-id, option: option } (+ current-tally u1))
        (ok true)
      )
    )
  )
)

(define-public (get-election-count)
  (ok (var-get next-election-id))
)

(define-public (check-election-existence (name (string-utf8 100)))
  (ok (is-election-registered name))
)

(define-read-only (compute-winner (election-id uint))
  (let ((election (unwrap! (map-get? elections election-id) none))
       (opts (get options election))
       (t (get threshold election)))
    (fold
      (lambda (acc opt)
        (let ((votes (get-tally election-id opt))
              (win (if (>= votes t) opt none)))
          (if (is-some win) (some win) acc)
        )
      )
      opts
      none
    )
  )
)