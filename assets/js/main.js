import { initSite } from './site.js';
import { initArticle } from './article.js';

initSite();

const prose = document.querySelector('.prose');
const article = document.querySelector('.article');
if (prose && article) initArticle(prose, article);
