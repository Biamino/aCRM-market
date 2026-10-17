import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { branch, BRANCHES, DEFAULT_BRANCH, findBranch, runInBranch } from "../src/db.js";
import {
  colorKey,
  diskPathFromUrl,
  galleryUrls,
  safeCrmPhotoName,
  toPublicUrl,
  UPLOAD_DIR,
  type ProductMedia,
} from "../src/product-media.js";

describe("филиалы", () => {
  it("по умолчанию два филиала Asdem 1 / Asdem 2 со своими базами", { skip: Boolean(process.env.BRANCHES) }, () => {
    assert.deepEqual(
      BRANCHES.map((b) => [b.id, b.name, b.db]),
      [
        ["asdem1", "Asdem 1", "crm_v1"],
        ["asdem2", "Asdem 2", "crm_dordoi"],
      ],
    );
    assert.notEqual(BRANCHES[0].pool, BRANCHES[1].pool);
  });

  it("findBranch ищет по id и не принимает мусор", () => {
    assert.equal(findBranch("asdem2"), BRANCHES[1]);
    assert.equal(findBranch("nope"), null);
    assert.equal(findBranch(["asdem1"]), null);
    assert.equal(findBranch(undefined), null);
  });

  it("branch() — первый филиал вне запроса и выбранный внутри runInBranch", async () => {
    assert.equal(branch(), DEFAULT_BRANCH);
    const second = BRANCHES[1];
    const seen = await runInBranch(second, async () => {
      await new Promise((r) => setTimeout(r, 5));
      return branch();
    });
    assert.equal(seen, second);
    assert.equal(branch(), DEFAULT_BRANCH);
  });

  it("параллельные запросы не путают филиалы", async () => {
    const results = await Promise.all(
      [0, 1, 0, 1].map((i, n) =>
        runInBranch(BRANCHES[i], async () => {
          await new Promise((r) => setTimeout(r, 10 - n * 2));
          return branch().id;
        }),
      ),
    );
    assert.deepEqual(results, ["asdem1", "asdem2", "asdem1", "asdem2"]);
  });
});

describe("фото товаров", () => {
  it("colorKey нормализует регистр и пробелы", () => {
    assert.equal(colorKey("  Чёрный "), "чёрный");
    assert.equal(colorKey(null), "");
    assert.equal(colorKey(undefined), "");
  });

  it("toPublicUrl оставляет внешние ссылки и добавляет ведущий слэш", () => {
    assert.equal(toPublicUrl("https://x.test/a.jpg"), "https://x.test/a.jpg");
    assert.equal(toPublicUrl("uploads/a.jpg"), "/uploads/a.jpg");
    assert.equal(toPublicUrl("/uploads/a.jpg"), "/uploads/a.jpg");
    assert.equal(toPublicUrl(""), "");
  });

  it("diskPathFromUrl кладёт файлы филиала в его папку", () => {
    assert.equal(
      diskPathFromUrl("/uploads/asdem2/products/7/a.jpg"),
      join(UPLOAD_DIR, "asdem2", "products", "7", "a.jpg"),
    );
  });

  it("safeCrmPhotoName отклоняет пути и спецсимволы", () => {
    assert.ok(safeCrmPhotoName("p_12-a.jpg"));
    assert.ok(!safeCrmPhotoName("../etc/passwd"));
    assert.ok(!safeCrmPhotoName("a/b.jpg"));
    assert.ok(!safeCrmPhotoName("a..jpg"));
    assert.ok(!safeCrmPhotoName(""));
  });

  it("galleryUrls: свой цвет → общие → CRM → обложка", () => {
    const media: ProductMedia = {
      web: new Map([
        ["чёрный", [{ id: 1, url: "/black.jpg" }]],
        ["", [{ id: 2, url: "/common.jpg" }]],
      ]),
      crm: ["/api/crm-photos/asdem1/c.jpg"],
    };
    assert.deepEqual(galleryUrls(media, "Чёрный", "/cover.jpg"), ["/black.jpg"]);
    assert.deepEqual(galleryUrls(media, "Белый", "/cover.jpg"), ["/common.jpg"]);
    assert.deepEqual(galleryUrls({ web: new Map(), crm: media.crm }, "Белый", "/cover.jpg"), media.crm);
    assert.deepEqual(galleryUrls({ web: new Map(), crm: [] }, null, "/cover.jpg"), ["/cover.jpg"]);
    assert.deepEqual(galleryUrls(undefined, null, null), []);
  });
});
