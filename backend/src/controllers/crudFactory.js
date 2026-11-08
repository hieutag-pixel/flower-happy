// Tạo nhanh các API CRUD đơn giản (dùng cho Loại sản phẩm, Loại hoa, Mã giảm giá, Bài viết)
const { AppError, asyncHandler, slugify, escapeRegex, getPaging } = require('../utils/helpers');

module.exports = (Model, options = {}) => {
  const { searchField = 'name', slugFrom = null, publicFilter = { status: true }, defaultSort = { createdAt: -1 } } = options;

  const withSlug = async (data, excludeId) => {
    if (!slugFrom || !data[slugFrom]) return data;
    const base = slugify(data[slugFrom]);
    let slug = base;
    let i = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await Model.exists({ slug, _id: { $ne: excludeId } })) slug = `${base}-${i++}`;
    return { ...data, slug };
  };

  return {
    // GET / - người thường chỉ thấy bản ghi đang hiển thị, admin thấy tất cả
    list: asyncHandler(async (req, res) => {
      const isAdmin = req.user && req.user.role === 'admin';
      const filter = isAdmin ? {} : { ...publicFilter };
      Object.entries(options.queryFilters || {}).forEach(([q, field]) => {
        if (req.query[q]) filter[field] = req.query[q];
      });
      if (req.query.q) filter[searchField] = { $regex: escapeRegex(req.query.q), $options: 'i' };
      const { page, limit, skip } = getPaging(req.query, 50);
      let query = Model.find(filter).sort(defaultSort).skip(skip).limit(limit);
      if (options.populate) query = query.populate(options.populate);
      const [data, total] = await Promise.all([query, Model.countDocuments(filter)]);
      res.json({ success: true, data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }),

    // GET /:idOrSlug
    detail: asyncHandler(async (req, res) => {
      const key = req.params.id;
      const isId = /^[a-f\d]{24}$/i.test(key);
      const cond = isId ? { _id: key } : { slug: key };
      let query = Model.findOne(cond);
      if (options.populate) query = query.populate(options.populate);
      const doc = await query;
      const isAdmin = req.user && req.user.role === 'admin';
      if (!doc || (!isAdmin && doc.status === false)) throw new AppError('Không tìm thấy dữ liệu', 404);
      res.json({ success: true, data: doc });
    }),

    create: asyncHandler(async (req, res) => {
      let data = { ...req.body };
      delete data._id;
      if (options.beforeCreate) data = options.beforeCreate(data, req);
      data = await withSlug(data);
      const doc = await Model.create(data);
      res.status(201).json({ success: true, message: 'Thêm mới thành công', data: doc });
    }),

    update: asyncHandler(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw new AppError('Không tìm thấy dữ liệu', 404);
      let data = { ...req.body };
      delete data._id;
      if (slugFrom && data[slugFrom] && data[slugFrom] !== doc[slugFrom]) data = await withSlug(data, doc._id);
      doc.set(data);
      await doc.save();
      res.json({ success: true, message: 'Cập nhật thành công', data: doc });
    }),

    // Xoá: nếu có trường status thì chỉ ẩn (xoá mềm)
    remove: asyncHandler(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw new AppError('Không tìm thấy dữ liệu', 404);
      if (options.hardDelete) await doc.deleteOne();
      else {
        doc.status = false;
        await doc.save();
      }
      res.json({ success: true, message: options.hardDelete ? 'Đã xoá' : 'Đã ẩn (xoá mềm)' });
    }),
  };
};
