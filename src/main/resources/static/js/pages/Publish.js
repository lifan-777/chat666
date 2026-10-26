import { api, authHeaders, uploadUrl } from '../api.js';
import { CONDITIONS } from '../utils.js';

const { ref, reactive, computed, onMounted } = Vue;
const { useRoute, useRouter } = VueRouter;
const { ElMessage } = ElementPlus;

const LOCATIONS = ['东区宿舍楼下', '西区食堂门口', '图书馆一楼大厅', '教学楼 A 栋', '体育馆门口', '南区车棚'];

export default {
    name: 'PublishPage',
    setup() {
        const route = useRoute();
        const router = useRouter();
        const formRef = ref(null);
        const categories = ref([]);
        const fileList = ref([]);
        const submitting = ref(false);
        const loading = ref(false);
        const editingId = computed(() => route.params.id);

        const form = reactive({
            title: '',
            categoryId: null,
            conditionLevel: 'LIKE_NEW',
            price: undefined,
            originalPrice: undefined,
            tradeLocation: '',
            description: '',
        });

        const rules = {
            title: [{ required: true, message: '请输入标题', trigger: 'blur' }, { max: 50, message: '标题不能超过 50 个字', trigger: 'blur' }],
            categoryId: [{ required: true, message: '请选择分类', trigger: 'change' }],
            conditionLevel: [{ required: true, message: '请选择成色', trigger: 'change' }],
            price: [{ required: true, message: '请输入价格', trigger: 'blur' }],
            tradeLocation: [{ required: true, message: '请输入交易地点', trigger: 'blur' }],
            description: [{ required: true, message: '请描述一下你的宝贝', trigger: 'blur' }],
        };

        onMounted(async () => {
            categories.value = await api.categories();
            if (editingId.value) {
                loading.value = true;
                try {
                    const g = await api.goodsDetail(editingId.value);
                    Object.assign(form, {
                        title: g.title,
                        categoryId: g.categoryId,
                        conditionLevel: g.conditionLevel,
                        price: Number(g.price),
                        originalPrice: g.originalPrice == null ? undefined : Number(g.originalPrice),
                        tradeLocation: g.tradeLocation,
                        description: g.description,
                    });
                    fileList.value = g.images.map((url, i) => ({ name: 'image-' + i, url }));
                } finally {
                    loading.value = false;
                }
            }
        });

        function beforeUpload(file) {
            const okType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type);
            if (!okType) {
                ElMessage.error('只支持 jpg、png、gif、webp 格式的图片');
                return false;
            }
            if (file.size > 5 * 1024 * 1024) {
                ElMessage.error('图片不能超过 5MB');
                return false;
            }
            return true;
        }

        function onUploadError(err) {
            let message = '上传失败';
            try {
                message = JSON.parse(err.message).message || message;
            } catch (e) {
                // 非 JSON 错误信息，使用默认提示
            }
            ElMessage.error(message);
        }

        function imageUrls() {
            return fileList.value
                .map((f) => f.response?.data?.url || f.url)
                .filter((url) => url && !url.startsWith('blob:'));
        }

        function querySearch(text, cb) {
            cb(LOCATIONS.filter((l) => !text || l.includes(text)).map((value) => ({ value })));
        }

        async function submit() {
            await formRef.value.validate();
            const images = imageUrls();
            if (!images.length) {
                ElMessage.warning('请至少上传一张商品图片');
                return;
            }
            submitting.value = true;
            try {
                const payload = { ...form, images };
                if (editingId.value) {
                    await api.updateGoods(editingId.value, payload);
                    ElMessage.success('修改成功，已重新提交审核');
                } else {
                    await api.publishGoods(payload);
                    ElMessage.success('发布成功，等待管理员审核');
                }
                router.push('/me/goods');
            } finally {
                submitting.value = false;
            }
        }

        return {
            CONDITIONS, formRef, form, rules, categories, fileList, submitting, loading, editingId,
            uploadUrl, headers: computed(authHeaders), beforeUpload, onUploadError, querySearch, submit,
        };
    },
    template: `
    <div class="container form-page" v-loading="loading">
      <section class="panel">
        <h3 class="panel-title"><el-icon><Sell /></el-icon>{{ editingId ? '编辑商品' : '发布闲置' }}</h3>
        <el-alert type="info" show-icon :closable="false" style="margin-bottom: 20px"
                  title="为保障交易安全，商品发布或修改后需要管理员审核，通过后才会在首页展示" />
        <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
          <el-form-item label="商品图片" required>
            <div>
              <el-upload v-model:file-list="fileList" :action="uploadUrl" :headers="headers" name="file"
                         list-type="picture-card" accept="image/*" :limit="6" :before-upload="beforeUpload"
                         :on-error="onUploadError" :on-exceed="() => $message.warning('最多上传 6 张图片')">
                <el-icon><Plus /></el-icon>
              </el-upload>
              <div class="upload-tip">最多 6 张，第一张作为封面；支持 jpg / png / gif / webp，单张不超过 5MB</div>
            </div>
          </el-form-item>
          <el-form-item label="标题" prop="title">
            <el-input v-model="form.title" maxlength="50" show-word-limit placeholder="品牌型号 + 关键信息，例如：iPad Air 5 64G 带笔" />
          </el-form-item>
          <el-form-item label="分类" prop="categoryId">
            <el-select v-model="form.categoryId" placeholder="请选择分类" style="width: 240px">
              <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="成色" prop="conditionLevel">
            <el-radio-group v-model="form.conditionLevel">
              <el-radio-button v-for="c in CONDITIONS" :key="c.value" :value="c.value">{{ c.label }}</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="价格" prop="price">
            <el-input-number v-model="form.price" :min="0.01" :max="99999.99" :precision="2" :step="10" placeholder="出售价格" />
            <span class="muted" style="margin: 0 12px 0 24px">原价</span>
            <el-input-number v-model="form.originalPrice" :min="0.01" :max="99999.99" :precision="2" :step="10" placeholder="选填" />
          </el-form-item>
          <el-form-item label="交易地点" prop="tradeLocation">
            <el-autocomplete v-model="form.tradeLocation" :fetch-suggestions="querySearch" maxlength="50"
                             placeholder="例如：东区宿舍楼下" style="width: 360px" />
          </el-form-item>
          <el-form-item label="商品描述" prop="description">
            <el-input v-model="form.description" type="textarea" :rows="6" maxlength="2000" show-word-limit
                      placeholder="描述一下宝贝的购买时间、使用情况、有无瑕疵、配件是否齐全等" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" size="large" :loading="submitting" @click="submit">{{ editingId ? '保存修改' : '立即发布' }}</el-button>
            <el-button size="large" @click="$router.back()">取消</el-button>
          </el-form-item>
        </el-form>
      </section>
    </div>`,
};
