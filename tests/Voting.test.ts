import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";
import { sha256 } from "@noble/hashes/sha256";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_MAX_VOTERS = 101;
const ERR_INVALID_VOTE_OPTIONS = 102;
const ERR_INVALID_ELECTION_DUR = 103;
const ERR_INVALID_QUORUM = 104;
const ERR_INVALID_THRESHOLD = 105;
const ERR_ELECTION_ALREADY_EXISTS = 106;
const ERR_ELECTION_NOT_FOUND = 107;
const ERR_INVALID_ELECTION_TYPE = 115;
const ERR_INVALID_ANONYMITY_LEVEL = 116;
const ERR_INVALID_REVEAL_PERIOD = 117;
const ERR_INVALID_JURISDICTION = 118;
const ERR_INVALID_VOTE_CURRENCY = 119;
const ERR_INVALID_MIN_VOTES = 110;
const ERR_INVALID_MAX_VOTES = 111;
const ERR_MAX_ELECTIONS_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_AUTHORITY_NOT_VERIFIED = 109;
const ERR_NOT_REGISTERED = 121;
const ERR_ALREADY_VOTED = 122;
const ERR_VOTING_CLOSED = 123;
const ERR_INVALID_COMMITMENT = 124;
const ERR_REVEAL_FAILED = 125;
const ERR_QUORUM_NOT_MET = 126;
const ERR_INVALID_DELEGATE = 127;

interface Election {
  name: string;
  maxVoters: number;
  options: string[];
  duration: number;
  quorum: number;
  threshold: number;
  timestamp: number;
  creator: string;
  electionType: string;
  anonymityLevel: number;
  revealPeriod: number;
  jurisdiction: string;
  voteCurrency: string;
  status: boolean;
  minVotes: number;
  maxVotes: number;
}

interface ElectionUpdate {
  updateName: string;
  updateMaxVoters: number;
  updateOptions: string[];
  updateTimestamp: number;
  updater: string;
}

interface Voter {
  registered: boolean;
  voiceHash: Uint8Array;
  delegatedTo: string | null;
}

interface Vote {
  commitment: Uint8Array;
  revealed: boolean;
  option: string | null;
  salt: Uint8Array | null;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

interface Tally {
  [option: string]: number;
}

class VotingSystemMock {
  state: {
    nextElectionId: number;
    maxElections: number;
    creationFee: number;
    authorityContract: string | null;
    elections: Map<number, Election>;
    electionUpdates: Map<number, ElectionUpdate>;
    electionsByName: Map<string, number>;
    voters: Map<string, Voter>;
    votes: Map<string, Vote>;
    voted: Map<string, number[]>;
    tallies: Map<number, Tally>;
  } = {
    nextElectionId: 0,
    maxElections: 500,
    creationFee: 500,
    authorityContract: null,
    elections: new Map(),
    electionUpdates: new Map(),
    electionsByName: new Map(),
    voters: new Map(),
    votes: new Map(),
    voted: new Map(),
    tallies: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextElectionId: 0,
      maxElections: 500,
      creationFee: 500,
      authorityContract: null,
      elections: new Map(),
      electionUpdates: new Map(),
      electionsByName: new Map(),
      voters: new Map(),
      votes: new Map(),
      voted: new Map(),
      tallies: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  registerVoter(voiceHash: Uint8Array): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    if (this.state.voters.has(this.caller)) return { ok: false, value: false };
    this.state.voters.set(this.caller, {
      registered: true,
      voiceHash,
      delegatedTo: null,
    });
    return { ok: true, value: true };
  }

  delegateVote(to: string): Result<boolean> {
    if (!this.state.voters.has(this.caller)) return { ok: false, value: false };
    if (!this.state.voters.has(to)) return { ok: false, value: false };
    const voter = this.state.voters.get(this.caller)!;
    this.state.voters.set(this.caller, {
      ...voter,
      delegatedTo: to,
    });
    return { ok: true, value: true };
  }

  createElection(
    name: string,
    maxVoters: number,
    options: string[],
    duration: number,
    quorum: number,
    threshold: number,
    electionType: string,
    anonymityLevel: number,
    revealPeriod: number,
    jurisdiction: string,
    voteCurrency: string,
    minVotes: number,
    maxVotes: number
  ): Result<number> {
    if (this.state.nextElectionId >= this.state.maxElections) return { ok: false, value: ERR_MAX_ELECTIONS_EXCEEDED };
    if (!name || name.length > 100) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (maxVoters <= 0 || maxVoters > 1000) return { ok: false, value: ERR_INVALID_MAX_VOTERS };
    if (options.length < 1 || options.length > 10) return { ok: false, value: ERR_INVALID_VOTE_OPTIONS };
    if (duration <= 0) return { ok: false, value: ERR_INVALID_ELECTION_DUR };
    if (quorum > 100) return { ok: false, value: ERR_INVALID_QUORUM };
    if (threshold <= 0 || threshold > 100) return { ok: false, value: ERR_INVALID_THRESHOLD };
    if (!["public", "private", "dao"].includes(electionType)) return { ok: false, value: ERR_INVALID_ELECTION_TYPE };
    if (anonymityLevel > 3) return { ok: false, value: ERR_INVALID_ANONYMITY_LEVEL };
    if (revealPeriod > 60) return { ok: false, value: ERR_INVALID_REVEAL_PERIOD };
    if (!jurisdiction || jurisdiction.length > 100) return { ok: false, value: ERR_INVALID_JURISDICTION };
    if (!["STX", "sBTC"].includes(voteCurrency)) return { ok: false, value: ERR_INVALID_VOTE_CURRENCY };
    if (minVotes <= 0) return { ok: false, value: ERR_INVALID_MIN_VOTES };
    if (maxVotes <= 0) return { ok: false, value: ERR_INVALID_MAX_VOTES };
    if (this.state.electionsByName.has(name)) return { ok: false, value: ERR_ELECTION_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextElectionId;
    const election: Election = {
      name,
      maxVoters,
      options,
      duration,
      quorum,
      threshold,
      timestamp: this.blockHeight,
      creator: this.caller,
      electionType,
      anonymityLevel,
      revealPeriod,
      jurisdiction,
      voteCurrency,
      status: true,
      minVotes,
      maxVotes,
    };
    this.state.elections.set(id, election);
    this.state.electionsByName.set(name, id);
    this.state.nextElectionId++;
    return { ok: true, value: id };
  }

  getElection(id: number): Election | null {
    return this.state.elections.get(id) || null;
  }

  updateElection(id: number, updateName: string, updateMaxVoters: number, updateOptions: string[]): Result<boolean> {
    const election = this.state.elections.get(id);
    if (!election) return { ok: false, value: false };
    if (election.creator !== this.caller) return { ok: false, value: false };
    if (!updateName || updateName.length > 100) return { ok: false, value: false };
    if (updateMaxVoters <= 0 || updateMaxVoters > 1000) return { ok: false, value: false };
    if (updateOptions.length < 1 || updateOptions.length > 10) return { ok: false, value: false };
    if (this.state.electionsByName.has(updateName) && this.state.electionsByName.get(updateName) !== id) {
      return { ok: false, value: false };
    }

    const updated: Election = {
      ...election,
      name: updateName,
      maxVoters: updateMaxVoters,
      options: updateOptions,
      timestamp: this.blockHeight,
    };
    this.state.elections.set(id, updated);
    this.state.electionsByName.delete(election.name);
    this.state.electionsByName.set(updateName, id);
    this.state.electionUpdates.set(id, {
      updateName,
      updateMaxVoters,
      updateOptions,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  submitVote(electionId: number, commitment: Uint8Array): Result<boolean> {
    if (!this.state.voters.has(this.caller)) return { ok: false, value: false };
    const election = this.state.elections.get(electionId);
    if (!election) return { ok: false, value: false };
    if (!election.status) return { ok: false, value: false };
    if (this.blockHeight < election.timestamp || this.blockHeight > election.timestamp + election.duration) {
      return { ok: false, value: false };
    }
    const votedElections = this.state.voted.get(this.caller) || [];
    if (votedElections.includes(electionId)) return { ok: false, value: false };

    const key = `${electionId}-${this.caller}`;
    this.state.votes.set(key, {
      commitment,
      revealed: false,
      option: null,
      salt: null,
    });
    this.state.voted.set(this.caller, [...votedElections, electionId]);
    return { ok: true, value: true };
  }

  revealVote(electionId: number, option: string, salt: Uint8Array): Result<boolean> {
    const election = this.state.elections.get(electionId);
    if (!election) return { ok: false, value: false };
    const key = `${electionId}-${this.caller}`;
    const vote = this.state.votes.get(key);
    if (!vote) return { ok: false, value: false };
    if (vote.revealed) return { ok: false, value: false };

    const concatInput = new TextEncoder().encode(option + new TextDecoder().decode(salt));
    const expectedCommitment = sha256(concatInput);
    if (!Buffer.from(vote.commitment).equals(Buffer.from(expectedCommitment))) {
      return { ok: false, value: false };
    }
    if (!election.options.includes(option)) return { ok: false, value: false };

    const revealStart = election.timestamp + election.duration;
    const revealEnd = revealStart + election.revealPeriod;
    if (this.blockHeight <= revealStart || this.blockHeight > revealEnd) {
      return { ok: false, value: false };
    }

    this.state.votes.set(key, {
      ...vote,
      revealed: true,
      option,
      salt,
    });

    const currentTally = this.state.tallies.get(electionId)?.[option] || 0;
    const newTally = { ...this.state.tallies.get(electionId), [option]: currentTally + 1 };
    this.state.tallies.set(electionId, newTally);

    return { ok: true, value: true };
  }

  getElectionCount(): Result<number> {
    return { ok: true, value: this.state.nextElectionId };
  }

  checkElectionExistence(name: string): Result<boolean> {
    return { ok: true, value: this.state.electionsByName.has(name) };
  }

  computeWinner(electionId: number): string | null {
    const election = this.state.elections.get(electionId);
    if (!election) return null;
    const tally = this.state.tallies.get(electionId) || {};
    return election.options.find(option => (tally[option] || 0) >= election.threshold) || null;
  }
}

describe("VotingSystem", () => {
  let contract: VotingSystemMock;

  beforeEach(() => {
    contract = new VotingSystemMock();
    contract.reset();
  });

  it("registers a voter successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash = new TextEncoder().encode("hash123");
    const result = contract.registerVoter(voiceHash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const voter = contract.state.voters.get("ST1TEST");
    expect(voter?.registered).toBe(true);
    expect(voter?.voiceHash).toEqual(voiceHash);
  });

  it("rejects voter registration without authority", () => {
    const voiceHash = new TextEncoder().encode("hash123");
    const result = contract.registerVoter(voiceHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects duplicate voter registration", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash = new TextEncoder().encode("hash123");
    contract.registerVoter(voiceHash);
    const result = contract.registerVoter(voiceHash);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("delegates vote successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash1 = new TextEncoder().encode("hash1");
    const voiceHash2 = new TextEncoder().encode("hash2");
    contract.registerVoter(voiceHash1);
    contract.caller = "ST2TEST";
    contract.registerVoter(voiceHash2);
    contract.caller = "ST1TEST";
    const result = contract.delegateVote("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const voter = contract.state.voters.get("ST1TEST");
    expect(voter?.delegatedTo).toBe("ST2TEST");
  });

  it("rejects delegation without registration", () => {
    const result = contract.delegateVote("ST2TEST");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects invalid delegate", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash = new TextEncoder().encode("hash1");
    contract.registerVoter(voiceHash);
    const result = contract.delegateVote("ST3FAKE");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("creates an election successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createElection(
      "Vote2025",
      100,
      ["OptionA", "OptionB"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const election = contract.getElection(0);
    expect(election?.name).toBe("Vote2025");
    expect(election?.maxVoters).toBe(100);
    expect(election?.options).toEqual(["OptionA", "OptionB"]);
    expect(election?.duration).toBe(30);
    expect(election?.quorum).toBe(50);
    expect(election?.threshold).toBe(60);
    expect(election?.electionType).toBe("public");
    expect(election?.anonymityLevel).toBe(2);
    expect(election?.revealPeriod).toBe(10);
    expect(election?.jurisdiction).toBe("Global");
    expect(election?.voteCurrency).toBe("STX");
    expect(election?.minVotes).toBe(10);
    expect(election?.maxVotes).toBe(100);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate election names", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createElection(
      "Vote2025",
      100,
      ["OptionA", "OptionB"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    const result = contract.createElection(
      "Vote2025",
      200,
      ["OptionC", "OptionD"],
      60,
      60,
      70,
      "private",
      3,
      20,
      "Local",
      "sBTC",
      20,
      200
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_ELECTION_ALREADY_EXISTS);
  });

  it("rejects creation without authority contract", () => {
    const result = contract.createElection(
      "NoAuth",
      100,
      ["OptionA"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid max voters", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createElection(
      "InvalidVoters",
      1001,
      ["OptionA"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MAX_VOTERS);
  });

  it("rejects invalid options", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createElection(
      "InvalidOptions",
      100,
      [] as string[],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_VOTE_OPTIONS);
  });

  it("rejects invalid election type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createElection(
      "InvalidType",
      100,
      ["OptionA"],
      30,
      50,
      60,
      "invalid",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ELECTION_TYPE);
  });

  it("updates an election successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createElection(
      "OldElection",
      100,
      ["OldA", "OldB"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    const result = contract.updateElection(0, "NewElection", 150, ["NewA", "NewB"]);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const election = contract.getElection(0);
    expect(election?.name).toBe("NewElection");
    expect(election?.maxVoters).toBe(150);
    expect(election?.options).toEqual(["NewA", "NewB"]);
    const update = contract.state.electionUpdates.get(0);
    expect(update?.updateName).toBe("NewElection");
    expect(update?.updateMaxVoters).toBe(150);
    expect(update?.updateOptions).toEqual(["NewA", "NewB"]);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent election", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateElection(99, "NewElection", 150, ["NewA"]);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-creator", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createElection(
      "TestElection",
      100,
      ["A"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateElection(0, "NewElection", 150, ["NewA"]);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("submits a vote successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash = new TextEncoder().encode("hash1");
    contract.registerVoter(voiceHash);
    contract.createElection(
      "TestVote",
      100,
      ["A", "B"],
      100,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    contract.blockHeight = 10;
    const option = "A";
    const salt = new TextEncoder().encode("salt123");
    const commitment = sha256(option + new TextDecoder().decode(salt));
    const result = contract.submitVote(0, commitment);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const voted = contract.state.voted.get("ST1TEST");
    expect(voted).toContain(0);
    const vote = contract.state.votes.get("0-ST1TEST");
    expect(vote?.commitment).toEqual(commitment);
    expect(vote?.revealed).toBe(false);
  });

  it("rejects vote submission without registration", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createElection(
      "TestVote",
      100,
      ["A"],
      100,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    contract.blockHeight = 10;
    const commitment = new TextEncoder().encode("commit123");
    const result = contract.submitVote(0, commitment);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects vote after already voted", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash = new TextEncoder().encode("hash1");
    contract.registerVoter(voiceHash);
    contract.createElection(
      "TestVote",
      100,
      ["A"],
      100,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    contract.blockHeight = 10;
    const commitment = new TextEncoder().encode("commit123");
    contract.submitVote(0, commitment);
    const result = contract.submitVote(0, commitment);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects vote when closed", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash = new TextEncoder().encode("hash1");
    contract.registerVoter(voiceHash);
    contract.createElection(
      "TestVote",
      100,
      ["A"],
      10,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    contract.blockHeight = 20;
    const commitment = new TextEncoder().encode("commit123");
    const result = contract.submitVote(0, commitment);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("reveals a vote successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash = new TextEncoder().encode("hash1");
    contract.registerVoter(voiceHash);
    contract.createElection(
      "TestReveal",
      100,
      ["A", "B"],
      10,
      50,
      60,
      "public",
      2,
      20,
      "Global",
      "STX",
      10,
      100
    );
    contract.blockHeight = 5;
    const option = "A";
    const salt = new TextEncoder().encode("salt123");
    const commitment = sha256(option + new TextDecoder().decode(salt));
    contract.submitVote(0, commitment);
    contract.blockHeight = 15;
    const result = contract.revealVote(0, option, salt);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const vote = contract.state.votes.get("0-ST1TEST");
    expect(vote?.revealed).toBe(true);
    expect(vote?.option).toBe(option);
    expect(vote?.salt).toEqual(salt);
    const tally = contract.state.tallies.get(0)?.["A"];
    expect(tally).toBe(1);
  });

  it("rejects reveal with invalid commitment", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash = new TextEncoder().encode("hash1");
    contract.registerVoter(voiceHash);
    contract.createElection(
      "TestReveal",
      100,
      ["A"],
      10,
      50,
      60,
      "public",
      2,
      20,
      "Global",
      "STX",
      10,
      100
    );
    contract.blockHeight = 5;
    const commitment = new TextEncoder().encode("invalidcommit");
    contract.submitVote(0, commitment);
    contract.blockHeight = 15;
    const option = "A";
    const salt = new TextEncoder().encode("salt123");
    const result = contract.revealVote(0, option, salt);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects reveal too early", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash = new TextEncoder().encode("hash1");
    contract.registerVoter(voiceHash);
    contract.createElection(
      "TestReveal",
      100,
      ["A"],
      10,
      50,
      60,
      "public",
      2,
      20,
      "Global",
      "STX",
      10,
      100
    );
    contract.blockHeight = 5;
    const option = "A";
    const salt = new TextEncoder().encode("salt123");
    const commitment = sha256(option + new TextDecoder().decode(salt));
    contract.submitVote(0, commitment);
    contract.blockHeight = 10;
    const result = contract.revealVote(0, option, salt);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets creation fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(1000);
    contract.createElection(
      "TestFee",
      100,
      ["A"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects creation fee change without authority", () => {
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct election count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createElection(
      "Election1",
      100,
      ["A"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    contract.createElection(
      "Election2",
      200,
      ["B", "C"],
      60,
      60,
      70,
      "private",
      3,
      20,
      "Local",
      "sBTC",
      20,
      200
    );
    const result = contract.getElectionCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks election existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createElection(
      "TestElection",
      100,
      ["A"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    const result = contract.checkElectionExistence("TestElection");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkElectionExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("computes winner correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const voiceHash = new TextEncoder().encode("hash1");
    contract.registerVoter(voiceHash);
    contract.createElection(
      "WinnerTest",
      100,
      ["A", "B"],
      10,
      50,
      1,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    contract.blockHeight = 5;
    const optionA = "A";
    const saltA = new TextEncoder().encode("saltA");
    const commitmentA = sha256(optionA + new TextDecoder().decode(saltA));
    contract.submitVote(0, commitmentA);
    contract.blockHeight = 15;
    contract.revealVote(0, optionA, saltA);
    contract.caller = "ST2TEST";
    const voiceHash2 = new TextEncoder().encode("hash2");
    contract.registerVoter(voiceHash2);
    const optionB = "B";
    const saltB = new TextEncoder().encode("saltB");
    const commitmentB = sha256(optionB + new TextDecoder().decode(saltB));
    contract.submitVote(0, commitmentB);
    contract.revealVote(0, optionB, saltB);
    const winner = contract.computeWinner(0);
    expect(winner).toBe("A");
  });

  it("parses election parameters with Clarity types", () => {
    const name = stringUtf8CV("TestElection");
    const maxVoters = uintCV(100);
    const duration = uintCV(30);
    expect(name.value).toBe("TestElection");
    expect(maxVoters.value).toEqual(BigInt(100));
    expect(duration.value).toEqual(BigInt(30));
  });

  it("rejects election creation with empty name", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createElection(
      "",
      100,
      ["A"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_UPDATE_PARAM);
  });

  it("rejects election creation with max elections exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxElections = 1;
    contract.createElection(
      "Election1",
      100,
      ["A"],
      30,
      50,
      60,
      "public",
      2,
      10,
      "Global",
      "STX",
      10,
      100
    );
    const result = contract.createElection(
      "Election2",
      200,
      ["B"],
      60,
      60,
      70,
      "private",
      3,
      20,
      "Local",
      "sBTC",
      20,
      200
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_ELECTIONS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});