import { api } from '../../api.js';
import { confirmAction } from '../../utils.js';

const { ref, reactive, onMounted } = Vue;
const { ElMessage } = ElementPlus;

const ICONS = ['Iphone', 'Reading', 'House', 'Handbag', 'Basketball', 'Bicycle', 'Box', 'Monitor', 'Headset',
    'Camera', 'Coffee', 'Present', 'Brush', 'Football', 'Suitcase', 'Goods'];

export default {
    name: 'AdminCategories',
    setup() {
        const list = ref([]);
        const loading = ref(false);
        const formRef = ref(null);
        const dialog = reactive({ visible: false, id: null, saving: false });
        const form = reactive({ name: '', icon: 'Goods', sortOrder: 0 });
        const rules = { name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }] };

        async function load() {
            loading.value = true;
            try {
                list.value = await api.categories();
            } finally {
                loading.value = false;
            }
        }

        function open(row) {
            dialog.id = row?.id || null;
            Object.assign(form, row ? { name: row.name, icon: row.icon, sortOrder: row.sortOrder } : { name: '', icon: 'Goods', sortOrder: 0 });
            dialog.visible = true;
        }

        async function save() {
            await formRef.value.validate();
            dialog.saving = true;
            try {
                if (dialog.id) {
                    await api.updateCategory(dialog.id, form);
                } else {
                    await api.createCategory(form);
                }
                ElMessage.success('保存成功');
                dialog.visible = false;
                load();
            } finally {
                dialog.saving = false;
            }
        }

        async function remove(row) {
            if (!await confirmAction(`确定删除分类「${row.name}」吗？`)) return;
            await api.deleteCategory(row.id);
            ElMessage.success('已删除');
            load();
        }

        onMounted(load);
        return { ICONS, list, loading, formRef, dialog, form, rules, open, save, remove };
    },
    template: `
    <div class="panel">
      <h3 class="panel-title">分类管理</h3>
      <div class="toolbar">
        <el-button type="primary" @click="open()"><el-icon><Plus /></el-icon>&nbsp;新增分类</el-button>
      </div>
      <el-table :data="list" v-loading="loading">
        <el-table-column label="ID" prop="id" width="60" />
        <el-table-column label="图标" width="70">
          <template #default="{ row }"><el-icon :size="20"><component :is="row.icon || 'Goods'" /></el-icon></template>
        </el-table-column>
        <el-table-column label="名称" prop="name" />
        <el-table-column label="排序" prop="sortOrder" width="80" />
        <el-table-column label="商品数" prop="goodsCount" width="90" />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" @click="open(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog v-model="dialog.visible" :title="dialog.id ? '编辑分类' : '新增分类'" width="440px">
        <el-form ref="formRef" :model="form" :rules="rules" label-width="70px">
          <el-form-item label="名称" prop="name"><el-input v-model="form.name" maxlength="20" /></el-form-item>
          <el-form-item label="图标">
            <el-select v-model="form.icon" style="width: 100%">
              <el-option v-for="i in ICONS" :key="i" :value="i" :label="i">
                <span style="display: flex; align-items: center; gap: 8px"><el-icon><component :is="i" /></el-icon>{{ i }}</span>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="排序"><el-input-number v-model="form.sortOrder" :min="0" :max="999" /></el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialog.visible = false">取消</el-button>
          <el-button type="primary" :loading="dialog.saving" @click="save">保存</el-button>
        </template>
      </el-dialog>
    </div>`,
};
