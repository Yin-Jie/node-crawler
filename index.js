const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const ora = require('ora');
const chalk = require('chalk');
const symbols = require('log-symbols');

const url = 'https://v.qq.com/channel/movie?listpage=1&channel=movie&sort=18&_all=1';
const movies = [];

fs.remove('./dist'); // 删除文件夹
const spinner = ora('正在爬虫中...');
spinner.start();

request.get(url, (err, res, body) => {
  if (err) return err;
  createTreeCategory(res.body);
  linkMovie(movies).then(res => {
    createFile();
    spinner.succeed();
    console.log(symbols.success, chalk.green(`爬虫完毕！`));
  })
})

// 生成目录结构
function createTreeCategory(data) {
  const $ = cheerio.load(data);
  const kindTypeDom = $('.mod_list_filter').find('.filter_line');
  // 创建一级目录
  kindTypeDom.each(function (index, elem) {
    const firstCategory = this;
    const firObj = {
      key: $(firstCategory).data('key'),
      name:  $(firstCategory).find('.filter_label').text(),
      children: []
    }
    // 创建二级目录
    const secCategory = $(firstCategory).find('.filter_item');
    secCategory.each(function (inIndex, inElem) {
      const categoryObj = {
        key: $(this).data('value'),
        name: $(this).text(),
        list: []
      }
      firObj.children.push(categoryObj);
    })
    movies.push(firObj);
  })
}


// 请求电影
function queryMovie({ queryUrl, key, subKey }) {
  return new Promise((resolve, reject) => {
    request.get(queryUrl, (err, res) => {
      if (err) {
        reject(err);
      }
      const $ = cheerio.load(res.body);
      const movie = $('._mod_listpage .list_item');
      movie.each(function (index, elem) {
        const movieInfo = {
          name: $(this).find('.figure_title').text(),
          link: $(this).find('.figure').attr('href'),
          desc: $(this).find('.figure_desc').text()
        }
        // inItem.list.push(movieInfo);
        for (let i = 0; i < movies.length; i++) {
          if (movies[i]['key'] === key) {
            const list = movies[i].children;
            for (let j = 0; j < list.length; j++) {
              if (list[j].key === subKey) {
                list[j].list.push(movieInfo);
                break;
              }
            }
            break;
          }
        }
      })
      resolve(true);
    })
  })
}

// 获取目录结构下的电影
async function linkMovie(list) {
  const queryList = [];
  list.forEach((item, index) => {
    let url = 'https://v.qq.com/channel/movie?listpage=1&channel=movie&_all=1';
    item.children.forEach((inItem) => {
      const sliceUrl = `&${item.key}=${inItem.key}`;
      const queryUrl = url + sliceUrl;
      queryList.push({
        queryUrl,
        key: item.key,
        subKey: inItem.key
      });
    })
  })
  
  let i = 0;
  while (i < queryList.length) {
    await queryMovie(queryList[i]);
    i += 1;
  }
}

// 生成文件&文件夹
function createFile() {
  fs.mkdirSync('./dist');
  for (let i = 0; i < movies.length; i += 1) {
    let root = './dist';
    fs.mkdirSync(`${root}/${movies[i].name}`);
    for (let j = 0; j < movies[i].children.length; j += 1) {
      const item = movies[i].children[j];
      fs.mkdirSync(`${root}/${movies[i].name}/${item.name}`);
      for (let z = 0; z < item.list.length; z += 1) {
        const info = item.list[z];
        const content = `
          名称： ${info.name}
          描述： ${info.desc}
          链接： ${info.link}
        `;
        fs.writeFileSync(`${root}/${movies[i].name}/${item.name}/${info.name}.txt`, content);
      }
    }
  }
}