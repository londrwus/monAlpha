export const SKILL_REGISTRY_ABI = [
  // Registration
  {
    name: "registerSkill",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_ipfsHash", type: "string" },
      { name: "_pricePerUse", type: "uint256" },
    ],
    outputs: [],
  },
  // Usage
  {
    name: "useSkill",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "_skillId", type: "uint256" }],
    outputs: [],
  },
  // Creator management
  {
    name: "updateSkill",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_skillId", type: "uint256" },
      { name: "_newPrice", type: "uint256" },
      { name: "_newIpfsHash", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "deactivateSkill",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_skillId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "reactivateSkill",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_skillId", type: "uint256" }],
    outputs: [],
  },
  // View functions
  {
    name: "getSkill",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_skillId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "name", type: "string" },
          { name: "ipfsHash", type: "string" },
          { name: "pricePerUse", type: "uint256" },
          { name: "usageCount", type: "uint256" },
          { name: "totalRevenue", type: "uint256" },
          { name: "active", type: "bool" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getCreatorSkillIds",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_creator", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    name: "getSkillsByCreator",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_creator", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "creator", type: "address" },
          { name: "name", type: "string" },
          { name: "ipfsHash", type: "string" },
          { name: "pricePerUse", type: "uint256" },
          { name: "usageCount", type: "uint256" },
          { name: "totalRevenue", type: "uint256" },
          { name: "active", type: "bool" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
  },
  // State getters
  {
    name: "registrationFee",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "skillCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "owner",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "foundation",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  // Events
  {
    name: "SkillRegistered",
    type: "event",
    inputs: [
      { name: "skillId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "ipfsHash", type: "string", indexed: false },
      { name: "pricePerUse", type: "uint256", indexed: false },
    ],
  },
  {
    name: "SkillUsed",
    type: "event",
    inputs: [
      { name: "skillId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
