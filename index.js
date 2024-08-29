/*
 * ©2024 满月叶
 * GitHub: MoonLeeeaf
 * 核心代码部分
 */

// 该项目只用不到半天就完成了 2024.5.5 15：03：31

// 辅助类：异步请求
class Ajax {
    static get(url) {
        return new Promise((res) => $.get(url, (re) => res(re)))
    }
    static getJson(url) {
        return new Promise((res) => $.getJSON(url, (re) => res(re)))
    }
    static getRaw(url) {
        return new Promise((res) => {
            $.ajax({
                url: url,
                method: 'GET',
                xhrFields: {
                    responseType: 'arraybuffer'
                },
                success: function (data) {
                    res(data)
                },
                error: function (error) { }
            })
        })
    }
}

// 辅助类：哈希
class Hash {
    static md5(data) {
        return CryptoJS.MD5(data)
            .toString(CryptoJS.enc.Hex)
    }
    static sha256(data) {
        return CryptoJS.SHA256(data)
            .toString(CryptoJS.enc.Hex)
    }
}

// 大坑：不加分号可能会导致未知的异常且无法排查，害得我整五十年，气死我了，之前一直这样写都没问题的

// 核心类：反编译
class NemoDecompiler {
    static async decompile(user_id, work_ids, onUpdate) {
        if (!onUpdate) onUpdate = () => { }
        return new Promise(async (res, rej) => {
            try {
                // 初始化压缩包
                let zip = new JSZip();
                let f_user = zip.folder(user_id + "");
                let f_material = f_user.folder("user_material");
                let f_works = f_user.folder("user_works");

                for (let work_id of work_ids) {
                    // 死妈空数据 我操你妈 你他妈害得我中断了 你妈死了
                    if (work_id == '') continue
                    onUpdate(0)
                    let f_work = f_works.folder(work_id + "");
                    let f_record = f_work.folder("record");
                    // 储存了用户定义的资源，如果缺失会导致项目无法打开
                    let user_img = {
                        user_img_dict: {},
                    };
                    // 作品的基本信息
                    let meta = {
                        bcm_count: {
                            block_cnt_without_invisible: 0.0,
                            block_cnt: 0.0,
                            entity_cnt: 1.0,
                        },
                        bcm_name: "未命名作品", // Replace
                        bcm_url: "", // Replace
                        bcm_version: "0.16.2", // Replace // 这个样板使用的 Nemo 版本为 4.5.0
                        download_fail: false,
                        extraDatas: {},
                        have_published_status: false,
                        have_remote_resources: false,
                        isLandscape: false,
                        isMicroBit: false,
                        isValid: false,
                        mcloudVariable: [],
                        publish_preview: "",
                        publish_status: 0,
                        reviewState: 0,
                        template_id: 0,
                        term_id: 0,
                        type: 0,
                        upload_status: {
                            work_id: work_id, // Replace
                            have_uploaded: 2,
                        },
                    };
                    // 获取作品信息，并获取最新的源代码文件

                    // 正文开始

                    // workid.bcm
                    let info = await Ajax.getJson("https://api.codemao.cn/creation-tools/v1/works/" + work_id + "/source/public");
                    meta.bcm_url = info.work_urls[0];
                    // 谨防JSON数据大坑 害得我调试两年半 QSWL
                    let bcm = await Ajax.getJson(meta.bcm_url);
                    f_work.file(work_id + ".bcm", JSON.stringify(bcm));
                    console.log(bcm)

                    // workid.userimg
                    let usrimg = []
                    for (let k in bcm.styles.styles_dict) {
                        // 将自己的资源文件从远程文件导入进去
                        let url = bcm.styles.styles_dict[k].url;
                        if (url) {
                            // 获取资源文件，加到资源清单
                            usrimg.push({
                                id: k,
                                url: url
                            })
                        }
                    }

                    let len = /* Object.keys(bcm.audios.sounds).length +  */usrimg.length;

                    let i = 0;
                    // 谨防 of 写成 in 大坑
                    for (let v of usrimg) {
                        console.log(v)
                        let n = await this.buildImageResource(f_material, v.url);
                        user_img.user_img_dict[v.id] = {
                            id: v.id,
                            path: user_id + "/user_material/" + n
                        };
                        i++;
                        onUpdate(i / len);
                    }
                    f_work.file(work_id + ".userimg", JSON.stringify(user_img));

                    // 死妈音频 我不处理了 自生自灭吧
                    // workid.bcm -> audios.sounds: id, name, url, ext
                    // 谨防Object不可遍历大坑
                    /* console.log(bcm.audios.sounds)
                    for (let k of Object.keys(bcm.audios.sounds)) {
                        let v = bcm.audios.sounds[k];
                        console.log(v);
                        // 死人音频 为什么获取一个音频就卡死在这里 阿弥诺斯
                        console.log(await this.buildAudioResource(f_record, v.url, v.id, v.ext));
                        i++;
                        onUpdate(i / len);
                    } */

                    // workid.meta
                    meta.bcm_name = info.name;
                    meta.bcm_version = info.bcm_version;
                    f_work.file(work_id + ".meta", JSON.stringify(meta));

                    // workid.cover
                    meta.publish_preview = info.preview;
                    f_work.file(work_id + ".cover", await Ajax.get(info.preview));

                    onUpdate(1);
                }
                // 打包项目源代码
                res({
                    data: await zip.generateAsync({
                        type: "blob"
                    }), info: { name:"作品集合" }
                });
            } catch (e) {
                rej(e);
            }
        });
    }
    static async buildImageResource(m, url) {
        let data = ""
        try {
            data = await Ajax.getRaw(url);
        } catch (e) {
            data = "HTTP请求失败: " + e
        }
        // 截至 Nemo 4.5.0，命名不按照规范项目也不会无法打开
        // 因此我懒得研究命名了
        let n = Hash.sha256(url) + ".webp";
        m.file(n, data, {
            binary: true,
        });
        return n;
    }
    static async buildAudioResource(r, url, id, ext) {
        let data = ""
        try {
            data = await Ajax.getRaw(url);
        } catch (e) {
            data = "HTTP请求失败: " + e
        }
        let n = id + "." + ext;
        r.file(n, data, {
            binary: true,
        });
        return n;
    }
}
