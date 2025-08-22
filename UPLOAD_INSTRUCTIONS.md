# 上传到 GitHub 的步骤

由于命令行 Git 存在超时问题，请使用 VS Code 的图形界面完成上传：

## 方法 1：使用 VS Code 源代码管理（推荐）

1. **打开 VS Code 的源代码管理面板**
   - 点击左侧边栏的源代码管理图标（第三个图标）
   - 或按快捷键 `Ctrl+Shift+G`

2. **暂存所有更改**
   - 你会看到所有修改的文件列表
   - 点击 "更改" 旁边的 "+" 号，暂存所有文件

3. **提交更改**
   - 在消息框中输入提交信息：`Initial commit: T46 Matching System`
   - 点击 "✓" 勾号按钮提交

4. **推送到 GitHub**
   - 点击 "..." 菜单（更多操作）
   - 选择 "推送" 或 "推送到..."
   - 如果提示选择远程仓库，选择 `origin`
   - 如果提示输入凭据，使用你的 GitHub 账号登录

## 方法 2：使用 VS Code 终端

在 VS Code 终端中依次运行：

```bash
git add .
git commit -m "Initial commit: T46 Matching System"
git push -u origin main
```

## 方法 3：使用 GitHub Desktop

如果你安装了 GitHub Desktop：
1. 在 GitHub Desktop 中打开此仓库
2. 提交所有更改
3. 点击 "Push origin" 推送到 GitHub

## 远程仓库信息

- **仓库地址**: https://github.com/rossguagua/T46-Matching.git
- **分支**: main
- **远程名称**: origin

远程仓库已经在 `.git/config` 中配置好了。

## 如果遇到问题

1. **认证失败**: 确保 VS Code 已登录 GitHub（设置 > 账户）
2. **推送被拒绝**: 可能需要先拉取远程更改：`git pull origin main --allow-unrelated-histories`
3. **网络问题**: 检查是否能访问 github.com