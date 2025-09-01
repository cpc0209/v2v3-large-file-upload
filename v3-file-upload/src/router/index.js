import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/home.vue'
import FileUpload from '@/views/FileUpload.vue'
import FileManager from '@/views/FileManager.vue'
import MultipleUpload from '@/views/MultipleUpload.vue'
import DownloadView from '../views/DownloadView.vue'
import UploadImage from '../views/UploadImage.vue'

const routes = [
  {
    path: '/',
    redirect: '/home'  // 将根路径重定向到 /home
  },
  {
    path: '/home',
    name: 'home',
    component: Home
  },
  {
    path: '/file-upload',
    name: 'file-upload',
    component: FileUpload
  },
  {
    path: '/file-manager',
    name: 'file-manager',
    component: FileManager
  },
  {
    path: '/multiple-upload',
    name: 'multiple-upload',
    component: MultipleUpload
  },
  {
    path: '/download',
    name: 'download',
    component: DownloadView
  },
  {
    path: '/upload-image',
    name: 'upload-image',
    component: UploadImage
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router 