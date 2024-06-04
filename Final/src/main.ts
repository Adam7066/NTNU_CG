import {createApp} from 'vue'
import './style.css'
import App from './App.vue'
// import 'webgl-lint'
import {MessagePlugin} from 'tdesign-vue-next';
import 'tdesign-vue-next/es/style/index.css';

createApp(App).use(MessagePlugin).mount('#app')
