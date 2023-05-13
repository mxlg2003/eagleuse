import { describe, expect, test } from "vitest";

import { prisma } from "@acme/db";

import { handleFolder } from "../folder";
import { handleTagsGroup } from "../tagsGroup";
import mock from "./metadata.json";

describe("@acme/eagle base", async () => {
  await prisma.folder.deleteMany();
  await prisma.library.deleteMany({});

  const lib = await prisma.library.create({
    data: {
      name: "test",
      dir: "/test",
      type: "eagle",
    },
  });

  test("folder", async () => {
    await handleFolder(mock.folders, lib);

    const res = await prisma.folder.findMany();
    expect(res).toHaveLength(5);
  });

  test("tagsGroup", async () => {
    await handleTagsGroup(mock.tagsGroups, lib);

    const res = await prisma.tagsGroup.findMany();
    expect(res).toHaveLength(1);
  });
});
