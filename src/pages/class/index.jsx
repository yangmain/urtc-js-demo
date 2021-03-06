import React from "react";
import {
  Row,
  Col,
  Icon,
  Select,
  Modal,
  Radio,
  Input,
} from "@ucloud-fe/react-components";
import mobile from 'is-mobile';
import publishedSDK from "urtc-sdk";
// component组件
import MixStream from "../../components/mixStream";
import Nav from "../../components/nav/index";
import Write from "../../components/write/index";
import Exercrise from "../../components/exerscrise/index";
import Chat from "../../components/chat/index";
import ReactPlayer from "react-player";
import SubscribeVideo from "../../components/subscribe/index";
import "./index.scss";
import { imClient } from "../../common/serve/imServe.js";
import paramServer from "../../common/js/paramServer";
import { isIOS } from "../../common/browser";
const { Option, Size } = Select;

let sdk = publishedSDK;
console.log('sdk version ', sdk.version);

const { Client, Logger } = sdk;

if (process.env.REACT_APP_ENV === "pre") {
  Logger.setLogLevel("debug");
}

class ClassRoom extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      devicesList: [],
      token: null,
      roomId: null,
      params: null,
      monitorData: null,
      videoSrcObject: null,
      videoCurr: false,
      videoSrcObjectId: "",
      loadList: [],
      videoIdArr: [],
      deviceId: 0,
      settingVisible: false,
      recording: false,
      recordUrlVisible: false,
      recordUrl: "",
      recordText: "开始录制",
      recordParamModalShow: false,
      recordParam: {
        uid: paramServer.getParam().userId, // 主画面用户
        isAverage: true, //是否均分 true (是) false(否)
        type: "time", //1(时间水印) 2 (图片水印)  3（文字水印)
        remarks: "", //（type 2时代表图片水印url type 3代表水印文字）
        template: 1, //1-9  (模板) 录制信令加了几个参数  已更新到pre小班
        position: "right-top",
        relay: false
      },
      appData: {
        appId: paramServer.getParam().appId,
        userId: paramServer.getParam().userId,
        mediaType: paramServer.getParam().mediaType, //桌面和摄像头采集类型
        appkey: paramServer.getParam().appkey
      },
      users: [] // 房间内当前用户
    };
    this.videoList = [];
    this.online = this.online.bind(this);
    this.deviceIdChange = this.deviceIdChange.bind(this);
    this.setting = this.setting.bind(this);
    this.changeOk = this.changeOk.bind(this);
    // this.startVideo = this.startVideo.bind(this);
    this.desktop = this.desktop.bind(this);
    this.recording = this.recording.bind(this);
    this.isIOS = isIOS();
    this.isMobile = mobile({ tablet: true });
    this.exercrise = this.exercrise.bind(this);

    if (!sdk.isSupportWebRTC()) {
      if (mobile({tablet: true})) {
        if (isIOS()) {
          alert('当前浏览器不完全支持 WebRTC，为使用完整的功能，请使用最新的 Safari 浏览器访问站点');
        } else {
          alert('当前浏览器不完全支持 WebRTC，为使用完整的功能，请使用最新的 Chrome/Firefox 等浏览器访问站点');
        }
      } else {
        alert('当前浏览器不完全支持 WebRTC，为使用完整的功能，请使用最新的 Chrome/Firefox/Safari 等浏览器访问站点');
      }
    }
  }

  componentDidMount() {
    // 从缓存拿参数，退出清空
    let param = paramServer.getParam();
    this.setState(
      {
        params: param
      },
      () => {
        this.urtcInit(this.state.params.role_type);
      }
    );

    imClient.on('CallReply',(data) => {
      let {replyuserid , operation} = data
      let {params} = this.state
      if(params.userId === replyuserid && operation === "agree"){
        this.online();
      }
    })

    imClient.on('CallAuth',(data) => {
      if(data.operation == 'close' && paramServer.getParam().role_type == 1){
        this.downMic();
      }
    })

    window.addEventListener("beforeunload", this.leaveRoom);
  }

  leaveRoom = () => {
    this.client.leaveRoom();
  };

  componentWillUnmount() {
    window.removeEventListener("beforeunload", this.leaveRoom);
  }

  // 下麦操作，im消息过来后，退出重新加入房间
  downMic = () => {
    this.setState({
      remoteStreams: [],
      localStream:null,
    });
    this.client.leaveRoom(() => {
      this.urtcInit(1);
    });
  };

  //rtc初始化，role_type 为 1 推流， 为 2 推拉流
   urtcInit = role_type => {
    const appData = paramServer.getParam();
    const token = sdk.generateToken(
      appData.appId,
      appData.appkey,
      appData.roomId,
      appData.userId
    );
    const role = role_type === 0 ? "push" : role_type === 2 ? "push-and-pull" : "pull";
    console.log('role>>>', role, role_type)
    window.p = this.client = new Client(appData.appId, token, {
      type: appData.room_type === 0 ? "rtc" : "live",
      role: role
    });

    this.client.on("stream-published", stream => {
      console.log("stream-published ", stream);
      if (stream.mediaType === 'camera') {
        this.setState({
          localStream: stream
        });
      }
    });

    this.client.on("stream-subscribed", stream => {
      console.log("stream-subscribed ", stream);

      //老师id数组
      // let teacherIdArr = paramServer.getParam().teachList.map(e => {
      //   return e.UserId;
      // });
      const { remoteStreams = [] } = this.state;
      remoteStreams.push(stream);
      this.updateRtcList(this.client.getRemoteStreams());
      this.setState({
        remoteStreams,
        videoList: this.client.getRemoteStreams()
      });
    });

    this.client.on("user-added", user => {
      console.log("user-added ", user);
      const { users } = this.state;
      users.push(user);
      this.setState({ users });
    });

    this.client.on("user-removed", user => {
      console.log("user-removed ", user);
      const { users } = this.state;
      let idx = users.findIndex(item => item.uid === user.uid);
      if (idx >= 0) {
        users.splice(idx, 1);
      }
      this.setState({ users });
    });

    this.client.on("stream-added", stream => {
      console.log("stream-added ", stream);

      this.client.subscribe(stream.sid, e => {
        console.log("subscribe failure ", e);
      });
    });

    this.client.on("stream-removed", stream => {
      console.log("stream-removed ", stream);

      const { remoteStreams = [] } = this.state;
      const idx = remoteStreams.findIndex(item => stream.sid === item.sid);
      if (idx !== -1) {
        remoteStreams.splice(idx, 1);
      }
      this.setState({ remoteStreams });
    });

    this.client.on('screenshare-stopped', stream => {
      this.client.unpublish(stream.sid, (s) => {
        console.log('stop screen share ', s);
      }, (e) => {
        console.error('stop screen share ', e);
      });
    });

    this.client.on('stream-reconnected', (oldStream, newStream) => {
      if (oldStream.type === 'publish') {
        this.setState({ localStream: newStream });
      } else {
        const { remoteStreams } = this.state;
        const idx = remoteStreams.findIndex(item => item.sid === oldStream.sid);
        if (idx) {
          remoteStreams.splice(idx, 1, newStream);
        }
        this.setState({ remoteStreams });
      }
    });

    this.client.joinRoom(appData.roomId, appData.userId, (users, streams) => {
      // this.client.setVideoProfile('1280*720');
      console.log("current users and streams in room ", users, streams);

      if (role === 'pull') return;
      let opts = {
        audio: true,
        video: true,
        screen: false
      }
      if (this.isMobile) {
        opts.facingMode = 'user';
      }
      this.client.publish(
        opts,
        e => {
          alert(`发布失败 ${e}`);
          console.log("publish failure ", e);
        }
      );
    });
  };


  /**
   * @description 学生上麦操作，推出房间，更改房间类型并重新加入
   */
  online = () => {
    this.setState({
      remoteStreams: []
    });
    this.client.leaveRoom(() => {
      this.urtcInit(2);
    });
    // console.log(paramServer.getParam())
  };

  updateRtcList(arr) {
    let o = paramServer.getParam();
    paramServer.setParam(Object.assign(o, { rtcList: arr }));
  }

  deviceIdChange(e) {
    console.log(e);
    this.setState({
      deviceId: e
    });
  }

  setting() {
    this.setState({
      settingVisible: true
    });

    this.client.getLoudspeakers(
      getLoudspeakers => {
        console.log("get cameras success ", getLoudspeakers);
      },
      e => {
        console.log("get cameras failure ", e);
      }
    );

    this.client.getCameras(
      cameras => {
        console.log("get cameras success ", cameras);
        this.setState({
          videoIdArr: cameras
        });
      },
      e => {
        console.log("get cameras failure ", e);
      }
    );
  }

  changeOk() {
    this.setState({
      settingVisible: false
    });

    this.client.switchDevice(
      "video",
      this.state.deviceId,
      p => {
        console.log("switch camera success ", p);
      },
      e => {
        console.log("switch camera failure ", e);
      }
    );
  }
  

  recording = () => {
    const {recordParam } = this.state

    if (this.state.recording === false) {
      const bucket = "urtc-test";
      const region = "cn-bj";
      let obj = {
        ...recordParam,
      };
      const {
        uid,
        isAverage,
        type,
        template,
        position,
        relay
      } = recordParam;
      let { remarks } = recordParam;
      if (type === 'time'){
        remarks = '';
      }
      let params = {
        bucket: bucket,
        region: region,
        uid: uid,
        mainViewType: 'camera',
        waterMark: {
          position,
          type,
          remarks,
        },
        mixStream: {
          template,
          isAverage,
        },
      }
      if (relay) {
        params.relay = {
          fragment: 60
        }
      }
      this.client.startRecording(params,
        record => {
          console.log("start recording success ", record);
          const url = `http://${bucket}.${region}.ufileos.com/${record.FileName}.mp4`;
          // console.error(url);

          this.setState({
            recordUrl: url,
            recordText: "结束录制"
          });
          console.error("开始录制成功");
        }
      );
      this.setState({
        recording: true
      });
    } else {
      this.client.stopRecording(
        p => {
          console.log("stop recording success ", p);

          this.setState({
            recordUrlVisible: true,
            recordText: "开始录制"
          });
        },
        e => {
          console.log("stop recording failure ", e);
        }
      );
      this.setState({
        recording: false
      });
    }
  };

  filterSubTeacher = () => {
    const { remoteStreams = [] } = this.state;
    if (paramServer.getParam().teachList) {
      const { teachList = [] } = paramServer.getParam();
      const idArr = teachList.map(e => {
        return e.UserId;
      });
      console.log(idArr, paramServer.getParam());
      let targetArr = remoteStreams.filter(e => {
        console.log(e);
        return idArr.includes(e.uid);
      });

      return targetArr.length ? targetArr[0] : [];
    } else {
      return [];
    }
  };
  
  desktop() {
    this.client.publish({
      audio: false,
      video: false,
      screen: true 
    }, e => {
      console.log('screen share failed');
      alert(`屏幕分享发布失败 ${e}`);
    });
    /*
    this.client.switchScreen(() => {
      console.log('screen success');
    }, (err) => {
      console.log('screen failed');
      // this.urtcInit(this.state.params.role_type);
    });
    */
  }

  updataRecordParam = (type, e) => {
    console.log('updataRecordParam ', type, e)
    let obj = this.state.recordParam;
    switch (type) {
      case 'type':
      case 'isAverage':
      case 'template':
      case 'uid':
      case 'relay':
        obj[type] = e;
        break;
      case 'template':
        obj[type] = e.target.value - 0;
        break;
      default:
        obj[type] = e.target.value;
    }
    this.setState({
      recordParam: obj
    });
  };

  checkParamStart = () => {
    this.setState(
      {
        recordParamModalShow: false,
        recording: false
      },
      () => {
        this.recording();
      }
    );
  };

  startRecord = () => {
    const {recording} = this.state
    if(!recording){
      this.setState({
        recordParamModalShow: true
      })
    }else{
      this.recording()
    }
  }

  renderMixStreamUser = () => {
    const { users, appData } = this.state;
    const options = users.map(user => {
      return <Option key={user.uid} value={user.uid}>{user.uid}</Option>
    });
    options.unshift(<Option key={appData.userId} value={appData.userId}>当前用户</Option>);
    return options;
  }

  createOption = (num) => {
    let arr = []
    for (let index = 0; index < num; index++) {
      arr.push(
        <Option key={index+1} value={index+1}>{index+1}</Option>
      );
    }
    return arr
  }

  exercrise(){
    
  }

  renderDevice(device) {
    if (device.label) {
      return <span>{device.label}</span>;
    }
    return <span title={device.deviceId}>{`${device.deviceId.substr(0, 10)}...`}</span>;
  }

  render() {
    const {
      params,
      localStream,
      remoteStreams = [],
      videoList,
      recordParamModalShow,
      recordParam,
    } = this.state;
    const subTeacher = this.filterSubTeacher();
    const param = paramServer.getParam();
    const role = param.role_type === 0 ? "push" : param.role_type === 2 ? "push-and-pull" : "pull";
    const canRelay = !!(this.client && this.client.startMix);
    return (
      <div className="classroom_main">
        {/* <div className="start-video fr" onClick={this.startVideo}>
            <b><Icon type='video'/> </b>
                开启视频
        </div> */}

        {/* 录制 */}
        {
          canRelay
            ? <MixStream client={this.client}></MixStream>
            : (
        <div
          className="recording-video fr "
          onClick={() => {
            this.startRecord();
          }}
        >
          <Icon
            className={this.state.recording ? "recording" : ""}
            type="sxt"
          />
          {this.state.recordText}
        </div>
            )
        }
        <div className="act-top fr" onClick={this.setting}>
          <Icon type="cog" />
          切换摄像头
        </div>
        <div className="desktop fr" onClick={this.desktop}>
          <Icon className="stack" type="stack" />
          屏幕共享
        </div>
        <Exercrise roomId={this.state} />
        <Nav client={this.client} role={role} />
        <div className="classroom_layout clearfix">
          {/* <Sidebar></Sidebar> */}
          <Row
            style={{ height: "100%", width: "100%", padding: "0" }}
            gutter={0}
            type="flex"
          >
            <Col className="classroom_left" span={10}>
              <SubscribeVideo
                isTeacther={
                  params &&
                  (params.room_type === 0 ||
                    (params.room_type === 1/* && params.role_type === 2 移动端未判断用户角色，为三端统一，暂时注释掉*/))
                }
                localStream={localStream}
                streams={remoteStreams || []}
              />
              <Write appData={this.state.appData}></Write>
            </Col>
            <Col span={2}>
              {/* <Localvideo></Localvideo> */}
              {params && (
                <div className={`localvideo_main ${this.isMobile && this.isIOS?'mobile':''}`}>
                  {params.room_type === 0 ||
                    (params.room_type === 1/* && params.role_type === 2 移动端未判断用户角色，为三端统一，暂时注释掉*/) ? (
                    //小班课显示本地
                    <ReactPlayer
                      key={localStream && localStream.sid}
                      width="256px"
                      height="100%"
                      url={localStream && localStream.mediaStream}
                      muted={true}
                      playing
                      playsinline
                    />
                  ) : (
                    //大班课验证身份是否为老师显示
                    <ReactPlayer
                      key={subTeacher && subTeacher.sid}
                      width="256px"
                      height="100%"
                      volume={null}
                      url={subTeacher && subTeacher.mediaStream}
                      muted={false}
                      playing
                      playsinline
                      controls={this.isIOS}
                    />
                  )}
                </div>
              )}
              <Chat
                loadList={videoList || []}
                changeDataList={() => this.online()}
                params={params}
                urtcInit={() => this.downMic()}
                appData={this.state.appData}
              />
            </Col>
          </Row>
        </div>
        <Modal
          visible={this.state.settingVisible}
          onClose={() =>
            this.setState({
              settingVisible: false
            })
          }
          onOk={this.changeOk}
          size={"sm"}
          title="切换摄像头"
        >
          <div className="form-row device-id">
            摄像头
            <Select
              size="md"
              onChange={this.deviceIdChange}
              className="device-id_seclect"
            >
              {this.state.videoIdArr.map(i => (
                <Option value={i.deviceId} key={i.deviceId}>
                  { this.renderDevice(i) }
                </Option>
              ))}
            </Select>
          </div>
        </Modal>

        <Modal
          visible={this.state.recordUrlVisible}
          onClose={() =>
            this.setState({
              recordUrlVisible: false
            })
          }
          onOk={() =>
            this.setState({
              recordUrlVisible: false
            })
          }
          isAutoClose={false}
          size={"sm"}
          title="录制结束"
        >
          <div className="form-row device-id">
            <a href={this.state.recordUrl} target="_blank" rel="noopener noreferrer">
              回看地址
            </a>
            {/* 录制结束，请到本地服务录制目录查看 */}
          </div>
        </Modal>

        {/*设置录制参数 */}

        <Modal
          visible={recordParamModalShow}
          onClose={() =>
            this.setState({
              recordParamModalShow: false
            })
          }
          onOk={() => this.checkParamStart()}
          isAutoClose={false}
          size={"md"}
          title="设置录制参数"
        >
          <div className="form-row device-id">
            <span style={{ display: "inline-block", width: "80px" }}>
              主画面用户
            </span>
            <Select
              onChange={this.updataRecordParam.bind(this, "uid")}
              size="md"
              value={recordParam.uid}
              style={{ width: "144px" }}
            >
              { this.renderMixStreamUser() }
            </Select>
          </div>
          <div className="form-row device-id">
            <span style={{ display: "inline-block", width: "80px" }}>
              录制流数
            </span>
            <Select
              onChange={this.updataRecordParam.bind(this, "template")}
              size="md"
              value={recordParam.template}
              style={{ width: "144px" }}
            >
              {this.createOption(9)}
            </Select>
          </div>
          <div className="form-row device-id">
            <span style={{ display: "inline-block", width: "80px" }}>
              混流风格
            </span>
            <div style={{ display: "inline-block" }}>
              <Radio.Group
                onChange={this.updataRecordParam.bind(this, "isAverage")}
                size="md"
                value={recordParam.isAverage}
                disabled={false}
              >
                <Radio key={1} value={true}>
                  平铺
                </Radio>
                <Radio key={2} value={false}>
                  垂直
                </Radio>
              </Radio.Group>
            </div>
          </div>

          <div className="form-row device-id">
            <span style={{ display: "inline-block", width: "80px" }}>
              水印类型
            </span>

            <div style={{ display: "inline-block" }}>
              <Radio.Group
                onChange={this.updataRecordParam.bind(this, "type")}
                size="md"
                value={recordParam.type}
                disabled={false}
              >
                <Radio key={1} value={"time"}>
                  时间水印
                </Radio>
                <Radio key={2} value={"image"}>
                  图片水印
                </Radio>
                <Radio key={3} value={"text"}>
                  文字水印
                </Radio>
              </Radio.Group>
            </div>
          </div>
          {recordParam.type !== "time" && (
            <div className="form-row device-id">
              <span style={{ display: "inline-block", width: "80px" }}>
                水印内容
              </span>
              <div style={{ display: "inline-block" }}>
                <Input
                  onChange={this.updataRecordParam.bind(this, "remarks")}
                  size="md"
                  value={recordParam.remarks}
                  placeholde="图片水印填写Url"
                />
              </div>
            </div>
          )}
          <div className="form-row device-id">
            <span style={{ display: "inline-block", width: "80px" }}>
              是否转推
            </span>

            <div style={{ display: "inline-block" }}>
              <Radio.Group
                onChange={this.updataRecordParam.bind(this, "relay")}
                size="md"
                value={recordParam.relay}
                disabled={false}
              >
                <Radio key={1} value={true}>
                  是
                </Radio>
                <Radio key={2} value={false}>
                  否
                </Radio>
              </Radio.Group>
            </div>
          </div>
        </Modal>
      </div>
    );
  }
}

export default ClassRoom;
