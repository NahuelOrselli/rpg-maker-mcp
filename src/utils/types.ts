/**
 * RPG Maker MZ Type Definitions
 * Based on actual engine data from newdata/data/*.json
 */

// ============================================================================
// Database Entity Interfaces
// ============================================================================

export interface RPGEffect {
    code: number;     // 11=RecoverHP, 12=RecoverMP, 21=AddState, 22=RemoveState, 42=Grow
    dataId: number;
    value1: number;   // Percentage or fixed value
    value2: number;   // Fixed amount (when value1 is %)
}

export interface RPGDamage {
    type: number;       // 0=None, 1=HPDamage, 2=MPDamage, 3=HPRecover, 4=MPRecover, 5=HPDrain, 6=MPDrain
    elementId: number;
    formula: string;
    variance: number;
    critical: boolean;
}

export interface RPGItem {
    id: number;
    name: string;
    description: string;
    iconIndex: number;
    price: number;
    itypeId: number;      // 1=Regular, 2=KeyItem, 3=HiddenA, 4=HiddenB
    consumable: boolean;
    scope: number;        // 0=None, 7=OneAlly, 8=AllAllies, 9=OneAllyDead, 11=User
    occasion: number;     // 0=Always, 1=Battle, 2=Menu, 3=Never
    animationId: number;
    damage: RPGDamage;
    effects: RPGEffect[];
    hitType: number;      // 0=CertainHit, 1=Physical, 2=Magical
    repeats: number;
    speed: number;
    successRate: number;
    tpGain: number;
    note: string;
}

export interface RPGActor {
    id: number;
    name: string;
    nickname: string;
    classId: number;
    initialLevel: number;
    maxLevel: number;
    characterName: string;
    characterIndex: number;
    faceName: string;
    faceIndex: number;
    battlerName: string;
    equips: number[];
    profile: string;
    note: string;
}

export interface RPGClass {
    id: number;
    name: string;
    expParams: number[];
    params: number[][];
    learnings: { level: number; skillId: number; note: string }[];
    traits: RPGTrait[];
    note: string;
}

export interface RPGTrait {
    code: number;
    dataId: number;
    value: number;
}

export interface RPGSkill {
    id: number;
    name: string;
    description: string;
    iconIndex: number;
    stypeId: number;
    scope: number;
    occasion: number;
    mpCost: number;
    tpCost: number;
    damage: RPGDamage;
    effects: RPGEffect[];
    requiredWtypeId1: number;
    requiredWtypeId2: number;
    speed: number;
    successRate: number;
    repeats: number;
    tpGain: number;
    hitType: number;
    animationId: number;
    message1: string;
    message2: string;
    note: string;
}

export interface RPGWeapon {
    id: number;
    name: string;
    description: string;
    iconIndex: number;
    price: number;
    wtypeId: number;
    etypeId: number;
    params: number[];
    traits: RPGTrait[];
    animationId: number;
    note: string;
}

export interface RPGArmor {
    id: number;
    name: string;
    description: string;
    iconIndex: number;
    price: number;
    atypeId: number;
    etypeId: number;
    params: number[];
    traits: RPGTrait[];
    note: string;
}

export interface RPGEnemy {
    id: number;
    name: string;
    battlerName: string;
    battlerHue: number;
    params: number[];
    exp: number;
    gold: number;
    dropItems: { kind: number; dataId: number; denominator: number }[];
    actions: { conditionParam1: number; conditionParam2: number; conditionType: number; rating: number; skillId: number }[];
    traits: RPGTrait[];
    note: string;
}

export interface RPGState {
    id: number;
    name: string;
    iconIndex: number;
    restriction: number;
    priority: number;
    motion: number;
    overlay: number;
    removeAtBattleEnd: boolean;
    removeByRestriction: boolean;
    autoRemovalTiming: number;
    minTurns: number;
    maxTurns: number;
    removeByDamage: boolean;
    chanceByDamage: number;
    removeByWalking: boolean;
    stepsToRemove: number;
    message1: string;
    message2: string;
    message3: string;
    message4: string;
    traits: RPGTrait[];
    note: string;
}

// ============================================================================
// Map Interfaces
// ============================================================================

export interface RPGMapInfo {
    id: number;
    name: string;
    parentId: number;
    expanded: boolean;
    scrollX: number;
    scrollY: number;
    order: number;
}

export interface RPGMap {
    displayName: string;
    tilesetId: number;
    width: number;
    height: number;
    scrollType: number;     // 0=NoLoop, 1=LoopVertical, 2=LoopHorizontal, 3=LoopBoth
    specifyBattleback: boolean;
    battleback1Name: string;
    battleback2Name: string;
    autoplayBgm: boolean;
    bgm: { name: string; pan: number; pitch: number; volume: number };
    autoplayBgs: boolean;
    bgs: { name: string; pan: number; pitch: number; volume: number };
    disableDashing: boolean;
    encounterList: { regionSet: number[]; troopId: number; weight: number }[];
    encounterStep: number;
    parallaxName: string;
    parallaxLoopX: boolean;
    parallaxLoopY: boolean;
    parallaxSx: number;
    parallaxSy: number;
    parallaxShow: boolean;
    data: number[];
    events: (RPGEvent | null)[];
    note: string;
}

export interface RPGEvent {
    id: number;
    name: string;
    x: number;
    y: number;
    pages: RPGEventPage[];
    note: string;
}

export interface RPGEventPage {
    conditions: {
        actorId: number;
        actorValid: boolean;
        itemId: number;
        itemValid: boolean;
        selfSwitchCh: string;
        selfSwitchValid: boolean;
        switch1Id: number;
        switch1Valid: boolean;
        switch2Id: number;
        switch2Valid: boolean;
        variableId: number;
        variableValid: boolean;
        variableValue: number;
    };
    directionFix: boolean;
    image: {
        tileId: number;
        characterName: string;
        direction: number;
        pattern: number;
        characterIndex: number;
    };
    list: RPGEventCommand[];
    moveFrequency: number;
    moveRoute: { list: { code: number; parameters: unknown[] }[]; repeat: boolean; skippable: boolean; wait: boolean };
    moveSpeed: number;
    moveType: number;
    priorityType: number;
    stepAnime: boolean;
    through: boolean;
    trigger: number;
    walkAnime: boolean;
}

export interface RPGEventCommand {
    code: number;
    indent: number;
    parameters: unknown[];
}

// ============================================================================
// Plugin Interfaces
// ============================================================================

export interface PluginConfig {
    name: string;
    status: boolean;
    description: string;
    parameters: Record<string, string>;
}

// ============================================================================
// System Interfaces
// ============================================================================

export interface RPGSystem {
    gameTitle: string;
    versionId: number;
    locale: string;
    partyMembers: number[];
    currencyUnit: string;
    startMapId: number;
    startX: number;
    startY: number;
    variables: string[];
    switches: string[];
    terms?: {
        basic: string[];
        commands: string[];
        params: string[];
        messages: Record<string, string>;
    };
    [key: string]: unknown;
}

// ============================================================================
// Tileset Interfaces
// ============================================================================

export interface RPGTileset {
    id: number;
    name: string;
    mode: number;         // 0=Field, 1=Area
    tilesetNames: string[];
    flags: number[];
    note: string;
}

// ============================================================================
// Enums / Constants
// ============================================================================

export const ItemType = {
    Regular: 1,
    KeyItem: 2,
    HiddenA: 3,
    HiddenB: 4,
} as const;

export const Scope = {
    None: 0,
    OneEnemy: 1,
    AllEnemies: 2,
    OneRandomEnemy: 3,
    TwoRandomEnemies: 4,
    ThreeRandomEnemies: 5,
    FourRandomEnemies: 6,
    OneAlly: 7,
    AllAllies: 8,
    OneAllyDead: 9,
    AllAlliesDead: 10,
    User: 11,
} as const;

export const Occasion = {
    Always: 0,
    Battle: 1,
    Menu: 2,
    Never: 3,
} as const;

export const EffectCode = {
    RecoverHP: 11,
    RecoverMP: 12,
    GainTP: 13,
    AddState: 21,
    RemoveState: 22,
    AddBuff: 31,
    AddDebuff: 32,
    RemoveBuff: 33,
    RemoveDebuff: 34,
    SpecialEffect: 41,
    Grow: 42,
    LearnSkill: 43,
    CommonEvent: 44,
} as const;

export const DamageType = {
    None: 0,
    HPDamage: 1,
    MPDamage: 2,
    HPRecover: 3,
    MPRecover: 4,
    HPDrain: 5,
    MPDrain: 6,
} as const;

export const ScrollType = {
    NoLoop: 0,
    LoopVertical: 1,
    LoopHorizontal: 2,
    LoopBoth: 3,
} as const;
