<template>
  <div class="app-container">
    <el-config-provider>
      <router-view></router-view>
    </el-config-provider>
  </div>
</template>

<script setup>
// 修改引入方式
import { ElConfigProvider } from 'element-plus'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.app-container {
  width: 100%;
  min-height: 100vh;
  background: #f5f7fa;
}
</style>