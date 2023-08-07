import { join } from "path";
import * as Sentry from "@sentry/electron";
import * as fs from "fs-extra";

import { CONSTANT, type Constant } from "@acme/constant";
import curd from "@acme/curd";
import { type Library } from "@acme/db";
import { rgbToHex } from "@acme/util";

import { type Metadata } from "../types";

/**
 * Create image
 * @param path metadata.json path
 */
export const createImage = async (path: string, library: Library) => {
  const base = getImageBase(path);
  const args = transformImageArgs(base, library);

  if (!args) return null;
  if (args.isDeleted) return null;

  return await curd.image.create(args);
};

/**
 * Update image
 * @param path metadata.json path
 */
export const updateImage = async (path: string, library: Library) => {
  const base = getImageBase(path);
  if (!base) return null;

  const args = transformImageArgs(base, library);

  if (!args) return null;
  if (args.isDeleted) {
    return await curd.image.delete({
      path: base.imagePath,
    });
  }

  const image = await curd.image.get({
    path: base.imagePath,
    libraryId: library.id,
  });

  const item = image[0];
  if (item) {
    // update tags
    for (const tag of item.tags) {
      await curd.tag.upsert({
        libraryId: library.id,
        name: tag.name,
        imageIds: [item.id],
      });
    }

    // update color
    await Promise.all(
      item.colors
        .map((c) => rgbToHex(c.rgb))
        .filter(Boolean)
        .splice(0, 9)
        .map(
          (hex) =>
            hex &&
            curd.color.create({
              imageId: item.id,
              color: hex,
            }),
        ),
    );

    return await curd.image.update({
      id: item.id,
      ...args,
    });
  }

  return false;
};

/**
 * image metadata base
 * @param path metadata.json path
 * @returns
 */
const getImageBase = (path: string) => {
  try {
    const metadata = fs.readJSONSync(path) as Metadata;
    const stats = fs.statSync(path);
    const imagePath = join("images", `${metadata.id}.info`, `${metadata.name}.${metadata.ext}`);
    const thumbnailPath = metadata.noThumbnail ? imagePath : join("images", `${metadata.id}.info`, `${metadata.name}_thumbnail.png`);
    const ext = metadata.ext as Constant["ext"];

    if (!CONSTANT["EXT"].includes(ext)) {
      throw new Error(`Unsupported image type: ${ext}, ${path}`);
    }

    return {
      metadata,
      stats,
      imagePath,
      thumbnailPath,
      ext,
    };
  } catch (error) {
    Sentry.captureException(error);
    return null;
  }
};

/**
 * Transform Image Args
 * @param path metadata.json path
 * @param library
 * @returns Image | undefined, undefined means the image is not supported
 */
const transformImageArgs = (base: ReturnType<typeof getImageBase>, library: Library) => {
  if (!base) return null;
  const { metadata, stats, imagePath, thumbnailPath, ext } = base;

  return {
    isDeleted: metadata.isDeleted,
    libraryId: library.id,
    path: imagePath,
    thumbnailPath,
    name: metadata.name,
    size: metadata.size,
    createTime: stats.ctime,
    lastTime: stats.mtime,
    ext,
    width: metadata.width,
    height: metadata.height,
    duration: metadata.duration,
    folders: metadata.folders ? metadata.folders.map((folder) => ({ id: folder })) : undefined,
    tags: metadata.tags,
    colors: metadata.palettes
      ? (metadata.palettes
          .map((palette) => rgbToHex(palette.color))
          .filter((c) => !!c)
          .splice(0, 9) as string[])
      : undefined,
  };
};
