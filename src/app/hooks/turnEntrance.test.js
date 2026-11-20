import { readFileSync, readdirSync } from "node:fs";
import { Linter } from "eslint";
import { expect, it } from "vitest";

const hooks = {
  useScreenHandlers: "handleNpcLook handleNpcTalk handleNpcGift handleInviteCompanion handleConsumeItem handleCollectGround handleNpcTrade handleNpcLearnSkill handleNpcSteal giftToCharacter handleToggleEquip claimMilestone",
  useBuildingHandlers: "handleBuildingInn handleBuildingHeal handleBuySkill handleGamble handleTravel handleServiceOrder handleCook handlePray handleReadBook handleBuyBook handleDeposit handleWithdraw handlePledge handleRedeem handleAcceptEscort handleAcceptBounty handleClaimBounty handleGambleSettle handleForgeCommission handleJadeCraft handleListenRumor handleJoinSect handleAuctionWin",
  useProgressionHandlers: "confessToNarrator meditate trainNeigong trainWaigong breakthroughSkill",
  usePlayerActionHandlers: "handleComfort handleSwitchCompanion handleResolveTrauma enterSeaOfMind leaveSeaOfMind",
  usePigeonHandlers: "pigeonDelayShichen applyPigeonResult sendPigeonLetter buyPigeon handleCollectPigeons handlePostSend",
  useCardImportHandlers: "handleImportNpcs handleImportPlayer handleImportWorld handleCreateCharacter handleOpeningFinish handleBodyProfileChange",
  useDuel: "handleNpcDuel confirmDuel cancelDuel duelFinishHandler",
  useQuestPanel: "forceAdvanceQuest triggerQuestFromPanel triggerQuestChoice",
};
const nonMutating = new Set(["pigeonDelayShichen", "handleOpeningFinish"]);

function parse(source) {
  let program;
  const messages = new Linter().verify(source, {
    plugins: { test: { rules: { capture: { create: () => ({ Program: (node) => { program = node; } }) } } } },
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
      else if (key === "triggerQuestChoice") {
        expect(entries, key).toEqual(["runQuestChoice"]);
        const choice = ast.body.find((node) => node.declaration?.id?.name === "runQuestChoice").declaration;
        expect(choice.body.body[0].argument.callee.name).toBe("applyResult");
      }
      else expect(entries, key).toEqual(["applyResult"]);
    }
  }
});
