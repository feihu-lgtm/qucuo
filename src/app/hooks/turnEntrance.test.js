import { readFileSync, readdirSync } from "node:fs";
import { Linter } from "eslint";
import { expect, it } from "vitest";

const hooks = {
  useScreenHandlers: "handleNpcLook handleNpcTalk handleNpcGift handleInviteCompanion handleOcRecruit handleStationCompanion handleRecallCompanion handleConsumeItem handleCollectGround handleNpcTrade handleNpcLearnSkill handleNpcSteal giftToCharacter handleToggleEquip claimMilestone",
  useBuildingHandlers: "handleFestivalEnter handleFestivalBet handleFestivalInvite handleFestivalNight handleFestivalWubi handleFestivalMidnight handleBuyTangmenItem handleSellFactionItem handleBuildingInn handleBuildingHeal handleClinicService handleChaojing handleBuySkill handleGamble handleTravel handleServiceOrder handleCook handlePray handleReadBook handleBuyBook handleDeposit handleWithdraw handlePledge handleRedeem handleAcceptEscort handleAcceptBounty handleClaimBounty handleGambleSettle handleForgeCommission handleJadeCraft handleListenRumor handleJoinSect handleLeaveSect handleAuctionWin",
  useProgressionHandlers: "confessToNarrator meditate trainNeigong trainWaigong breakthroughSkill",
  usePlayerActionHandlers: "handleComfort handleSwitchCompanion handleResolveTrauma enterSeaOfMind leaveSeaOfMind",
  usePigeonHandlers: "pigeonDelayShichen applyPigeonResult sendPigeonLetter buyPigeon handleCollectPigeons handlePostSend",
  useCardImportHandlers: "handleImportNpcs handleImportPlayer handleImportWorld handleCreateCharacter handleOpeningFinish handleBodyProfileChange",
  useDuel: "handleNpcDuel confirmDuel cancelDuel duelFinishHandler resetDuel",
  useQuestPanel: "forceAdvanceQuest triggerQuestFromPanel triggerQuestChoice savePersuasionProgress finishPersuasion",
};
const nonMutating = new Set(["pigeonDelayShichen", "handleOpeningFinish"]);

function parse(source, visitors = {}) {
  let program;
  const messages = new Linter().verify(source, {
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { test: { rules: { capture: { create: () => ({ ...visitors, Program: (node) => { program = node; } }) } } } },
    rules: { "test/capture": "error" },
  });
  expect(messages).toEqual([]);
  return program;
}

function calls(node) {
  return node?.type === "CallExpression" ? [node.callee.name]
    : (node?.body || []).filter((statement) => statement.type === "ExpressionStatement")
      .map((statement) => statement.expression.callee?.name);
}

it("enumerates all hook handler keys and checks gameplay handlers enter the monitor", () => {
  const directory = new URL(".", import.meta.url);
  expect(readdirSync(directory).filter((file) => /^use\w+Handlers\.js$/.test(file)).sort())
    .toEqual(Object.keys(hooks).filter((name) => name.endsWith("Handlers")).map((name) => `${name}.js`).sort());
  for (const [name, keys] of Object.entries(hooks)) {
    const ast = parse(readFileSync(new URL(`${name}.js`, directory), "utf8"));
    const body = ast.body.find((node) => node.declaration?.id?.name === name).declaration.body.body;
    const handlers = body.find((node) => node.type === "ReturnStatement").argument.properties.map((prop) => prop.key.name);
    expect(handlers, name).toEqual(keys.split(" "));
    const definitions = new Map(body.flatMap((node) => (node.declarations || []).map((decl) => [decl.id.name, decl.init])));
    for (const key of handlers.filter((key) => !nonMutating.has(key))) {
      const declaration = definitions.get(key);
      const handler = declaration.callee?.name === "useCallback" ? declaration.arguments[0] : declaration;
      const entries = calls(handler.body);
      if (key === "applyPigeonResult") expect(entries[0], key).toBe("applyResult");
      else if (key === "handlePostSend") expect(entries, key).toEqual(["setActiveBuilding", "sendPigeonLetter"]);
      else if (key === "triggerQuestChoice" || key === "finishPersuasion") {
        const delegate = key === "triggerQuestChoice" ? "runQuestChoice" : "settlePersuasion";
        expect(entries, key).toEqual([delegate]);
        const definition = ast.body.find((node) => node.declaration?.id?.name === delegate).declaration;
        expect(definition.body.body[0].argument.callee.name).toBe("applyResult");
      }
      else expect(entries, key).toEqual(["applyResult"]);
    }
  }
});

function directMutations(source) {
  const presentation = new Set(["setCharacterPageTarget", "setActiveNpcMenu", "setActiveItemMenu"]);
  const found = [];
  parse(source, { CallExpression(node) {
    const { callee } = node;
    for (let child = node; child.parent; child = child.parent) {
      const parent = child.parent;
      if (parent.type === "CallExpression" && parent.arguments[1] === child
        && parent.callee.type === "MemberExpression" && parent.callee.property.name === "dispatchCommand") return;
    }
    const name = callee.type === "MemberExpression" ? callee.property.name ?? callee.property.value : callee.name;
    const owner = callee.object?.name;
    if (owner === "localStorage" && name === "setItem") return;
    if (owner === "gameActions" || owner === "gameStore" && name === "setState"
      || !presentation.has(name) && /^(set[A-Z]|addLog$|applySnapshot$)/.test(name)) found.push(name);
  } });
  return found;
}

it("keeps inline gameplay mutations out of overlay and host components", () => {
  const fixture = '<Screen onFinish={() => { if (won) ctx.setChar(update); gameActions.setInv(items); }} />';
  expect(directMutations(fixture)).toEqual(["setChar", "setInv"]);
  expect(directMutations('<Screen onSave={() => ctx.dispatchCommand("settings", () => ctx.setApiCfg(update))} />')).toEqual([]);
  for (const path of ["../../ui/panels/GlobalOverlays.jsx", "../../ui/OverlayHost.jsx"]) {
    expect(directMutations(readFileSync(new URL(path, import.meta.url), "utf8")), path).toEqual([]);
  }
});
