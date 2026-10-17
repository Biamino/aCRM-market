import { useEffect, useMemo, useState } from "react";
import { api, apiUpload, fmtMoney } from "../../api";
import ProductImage from "../../components/ProductImage";

interface ProductImageItem {
  id: number;
  url: string;
}

/** Фото одного цвета модели; color === "" — общие фото модели. */
interface AdminColor {
  color: string;
  hex: string | null;
  photoCount: number;
  images: ProductImageItem[];
  coverUrl: string | null;
}

interface AdminProduct {
  id: number;
  sku: string;
  title: string;
  category: string;
  price: number;
  isVisible: boolean;
  imageUrl: string;
  photoCount: number;
  crmPhotoCount: number;
  colors: AdminColor[];
}

interface ListResponse {
  products: AdminProduct[];
  total: number;
  page: number;
  pageSize: number;
  visibleCount: number;
  hiddenCount: number;
  categories: { name: string; count: number }[];
}

export default function AdminProductsPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (appliedSearch) p.set("q", appliedSearch);
    if (category) p.set("category", category);
    if (visibility !== "all") p.set("visibility", visibility);
    p.set("page", String(page));
    return p.toString();
  }, [appliedSearch, category, visibility, page]);

  const load = () =>
    api<ListResponse>(`/admin/products?${query}`)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    setSelected([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function setVisibilityFor(ids: number[], isVisible: boolean) {
    if (ids.length === 0) return;
    setBusyId(ids[0]);
    setError("");
    try {
      if (ids.length === 1) {
        await api(`/admin/products/${ids[0]}/visibility`, {
          method: "PATCH",
          body: JSON.stringify({ isVisible }),
        });
      } else {
        const d = await api<{ updated: number }>(`/admin/products/visibility/bulk`, {
          method: "POST",
          body: JSON.stringify({ productIds: ids, isVisible }),
        });
        setMessage(isVisible ? `На витрине: ${d.updated}` : `Скрыто: ${d.updated}`);
      }
      await load();
      setSelected([]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function uploadPhotos(product: AdminProduct, section: AdminColor, files: FileList | null) {
    if (!files?.length) return;
    setUploading(`${product.id}:${section.color}`);
    setError("");
    try {
      const form = new FormData();
      for (const file of Array.from(files)) form.append("photos", file);
      const color = section.color ? `?color=${encodeURIComponent(section.color)}` : "";
      await apiUpload(`/admin/products/${product.id}/images${color}`, form);
      setMessage(section.color ? `Фото добавлены к цвету «${section.color}»` : "Общие фото модели добавлены");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(null);
    }
  }

  async function removePhoto(product: AdminProduct, imageId: number) {
    setError("");
    try {
      await api(`/admin/products/${product.id}/images/${imageId}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const pageIds = data?.products.map((p) => p.id) ?? [];
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  return (
    <div className="max-w-6xl">
      <p className="max-w-3xl text-sm leading-relaxed text-dim">
        Каталог, цвета и категории берутся из CRM и здесь не меняются. На витрину попадают только включённые
        модели. Фото витрины хранятся в маркете отдельно по цветам; если их нет — показываются фото из CRM.
      </p>

      {data && (
        <p className="mt-4 text-sm">
          На витрине <span className="tabular-nums">{data.visibleCount}</span>
          <span className="text-dim"> · скрыто {data.hiddenCount}</span>
        </p>
      )}

      {message && (
        <p role="status" className="mt-6 border border-brand px-4 py-3 text-sm">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 border border-red-700 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        className="mt-6 flex flex-wrap items-end gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setAppliedSearch(search.trim());
        }}
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="admin-search" className="label mb-1 block text-dim">
            Поиск
          </label>
          <input
            id="admin-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Артикул или название"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="admin-category" className="label mb-1 block text-dim">
            Категория
          </label>
          <select
            id="admin-category"
            className="min-h-11 cursor-pointer border border-line bg-transparent px-3 text-sm"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Все</option>
            {data?.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="admin-visibility" className="label mb-1 block text-dim">
            Витрина
          </label>
          <select
            id="admin-visibility"
            className="min-h-11 cursor-pointer border border-line bg-transparent px-3 text-sm"
            value={visibility}
            onChange={(e) => {
              setVisibility(e.target.value as typeof visibility);
              setPage(1);
            }}
          >
            <option value="all">Все товары CRM</option>
            <option value="visible">Только на витрине</option>
            <option value="hidden">Только скрытые</option>
          </select>
        </div>
        <button type="submit" className="btn px-6">
          Найти
        </button>
      </form>

      {selected.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3 border border-line px-4 py-3">
          <p className="text-sm">Выбрано: {selected.length}</p>
          <button type="button" className="btn px-4 py-2" onClick={() => setVisibilityFor(selected, true)}>
            Показать на витрине
          </button>
          <button type="button" className="btn-ghost px-4 py-2" onClick={() => setVisibilityFor(selected, false)}>
            Скрыть
          </button>
        </div>
      )}

      {data === null ? (
        <p className="py-10 text-sm text-dim">Загружаем каталог CRM…</p>
      ) : data.products.length === 0 ? (
        <p className="py-16 text-center text-sm text-dim">
          По этому фильтру товаров нет. Снимите поиск или выберите другую категорию.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-3 py-3">
                  <label className="sr-only" htmlFor="select-all">
                    Выбрать все на странице
                  </label>
                  <input
                    id="select-all"
                    type="checkbox"
                    className="h-4 w-4 cursor-pointer accent-brand-deep"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? pageIds : [])}
                  />
                </th>
                <th className="label px-3 py-3 font-normal text-dim">Товар</th>
                <th className="label px-3 py-3 font-normal text-dim">Категория</th>
                <th className="label px-3 py-3 font-normal text-dim">Фото</th>
                <th className="label px-3 py-3 font-normal text-dim">Опт</th>
                <th className="label px-3 py-3 font-normal text-dim">Витрина</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p) => {
                const expanded = openId === p.id;
                return (
                  <ProductRow
                    key={p.id}
                    product={p}
                    selected={selected.includes(p.id)}
                    expanded={expanded}
                    busy={busyId === p.id}
                    uploading={uploading}
                    onSelect={(checked) =>
                      setSelected((prev) => (checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                    }
                    onToggle={() => setVisibilityFor([p.id], !p.isVisible)}
                    onExpand={() => setOpenId(expanded ? null : p.id)}
                    onUpload={uploadPhotos}
                    onRemovePhoto={removePhoto}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.pageSize && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-dim">
            {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} из{" "}
            {data.total}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-ghost px-4 py-2"
              disabled={page <= 1}
              onClick={() => setPage((n) => Math.max(1, n - 1))}
            >
              Назад
            </button>
            <button
              type="button"
              className="btn-ghost px-4 py-2"
              disabled={page * data.pageSize >= data.total}
              onClick={() => setPage((n) => n + 1)}
            >
              Дальше
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRow({
  product,
  selected,
  expanded,
  busy,
  uploading,
  onSelect,
  onToggle,
  onExpand,
  onUpload,
  onRemovePhoto,
}: {
  product: AdminProduct;
  selected: boolean;
  expanded: boolean;
  busy: boolean;
  uploading: string | null;
  onSelect: (checked: boolean) => void;
  onToggle: () => void;
  onExpand: () => void;
  onUpload: (product: AdminProduct, section: AdminColor, files: FileList | null) => void;
  onRemovePhoto: (product: AdminProduct, imageId: number) => void;
}) {
  return (
    <>
      <tr className={`border-b border-line ${expanded ? "bg-muted/60" : ""}`}>
        <td className="px-3 py-3">
          <input
            type="checkbox"
            className="h-4 w-4 cursor-pointer accent-brand-deep"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            aria-label={`Выбрать ${product.title}`}
          />
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-3">
            <ProductImage
              src={product.imageUrl}
              alt=""
              width={48}
              height={64}
              className="h-16 w-12 shrink-0 object-cover"
            />
            <div className="min-w-0">
              <p className="font-medium">{product.title}</p>
              <p className="text-xs text-dim">
                {product.sku}
                {product.colors.some((c) => c.color) && (
                  <> · {product.colors.filter((c) => c.color).map((c) => c.color).join(", ")}</>
                )}
              </p>
              <button
                type="button"
                className="mt-1 label cursor-pointer text-brand-deep underline-offset-2 hover:underline"
                aria-expanded={expanded}
                onClick={onExpand}
              >
                {expanded ? "Скрыть фото" : "Фото"}
              </button>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-dim">{product.category}</td>
        <td className="px-3 py-3 tabular-nums">
          {product.photoCount}
          {product.crmPhotoCount > 0 && <span className="block text-xs text-dim">+{product.crmPhotoCount} в CRM</span>}
        </td>
        <td className="px-3 py-3 tabular-nums">{fmtMoney(product.price)}</td>
        <td className="px-3 py-3">
          <button
            type="button"
            role="switch"
            aria-checked={product.isVisible}
            disabled={busy}
            onClick={onToggle}
            className={`label min-h-11 cursor-pointer border px-3 transition-colors duration-200 ${
              product.isVisible
                ? "border-brand-deep bg-brand-deep text-on-brand"
                : "border-line text-dim hover:border-brand-deep hover:text-accent"
            }`}
          >
            {product.isVisible ? "На витрине" : "Скрыт"}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-line bg-muted/40">
          <td colSpan={6} className="px-4 py-5">
            <div className="grid gap-6 md:grid-cols-2">
              {product.colors.map((variant) => {
                const key = `${product.id}:${variant.color}`;
                return (
                <section key={key} className="border border-line bg-paper p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">
                      {variant.color ? `Цвет: ${variant.color}` : "Общие фото (для цветов без своих фото)"}
                    </h3>
                    <p className="text-xs text-dim">
                      {variant.photoCount} из 8 · первое фото — обложка карточки
                    </p>
                  </div>
                  {variant.images.length === 0 ? (
                    <p className="mt-3 text-sm text-dim">Пока нет загруженных фото.</p>
                  ) : (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {variant.images.map((img, index) => (
                        <li key={img.id} className="relative">
                          <ProductImage
                            src={img.url}
                            alt={`Фото ${index + 1}${variant.color ? `, ${variant.color}` : ""}`}
                            width={96}
                            height={128}
                            className="h-28 w-20 object-cover"
                          />
                          {index === 0 && (
                            <span className="label absolute left-0 top-0 bg-brand-deep px-1.5 py-0.5 text-on-brand">
                              Обложка
                            </span>
                          )}
                          <button
                            type="button"
                            className="label mt-1 w-full cursor-pointer text-red-700 underline-offset-2 hover:underline"
                            onClick={() => onRemovePhoto(product, img.id)}
                          >
                            Удалить
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label className="btn-ghost mt-4 inline-flex cursor-pointer px-4 py-2">
                    {uploading === key ? "Загружаем…" : "Добавить фото"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      disabled={uploading === key || variant.photoCount >= 8}
                      onChange={(e) => {
                        onUpload(product, variant, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </section>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
