// const Promise = require('bluebird');
const fs = require('fs');
const _ = require('lodash');
const moment = require('moment');
const co = require('co');
// Promise.promisifyAll(fs);
const uuid = require('node-uuid');


const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const gwcTripSchema = new mongoose.Schema({
    login_time: Date,
    lost_time: Date,
    imei: String,
    trip_no: {
        type: String,
        index: true,
        unique: true
    }, // 行程编号  全局唯一标识一个行程的字段

    positions: [{
        data_type: Number, // 1:GPS; 2: 2G; 3:LTE-4G
        data: {
            GPS: {
                altitude: Number, // 高度 单位（米）
                longitude: Number, //经度
                latitude: Number, //维度
                speed: Number, // 速度 km/h
                direction: Number, // 方向 range 0 ~ 360
            },
            _2G: {
                mobile_country_code: Number, // mmc 2 bytes
                mobile_network_code: Number, // mnc 2 bytes
                location_area_code1: Number, // lac 2 byts 
                cell_tower_id1: Number, // ci  2 bytes 
                location_area_code2: Number, // lac 
                cell_tower_id2: Number, // ci 2 bytes
                location_area_code3: Number, // lac 
                cell_tower_id3: Number, // ci 2 bytes
            },
            LTE4G: {
                mobile_country_code: Number, // mmc 2 bytes
                mobile_network_code: Number, // mnc 2 bytes
                cell_tower_id1: Number, // ci  4 bytes 
                location_area_code1: Number, // EARFCN 2 bytes
                cell_tower_id2: Number, // ci  4 bytes 
                location_area_code2: Number, // EARFCN 2 bytes
            }
        },
        reception_time: {
            type: Date,
            default: Date.now
        },
        serial_number: Number,
    }],
    is_alerted: {
        type: Boolean,
        default: false
    },
});

var save = function (trip) {
    return new Promise((resolve, reject) => {

        co(function* () {
            trip.save(function (err) {
                if (err) {
                    console.log("in function convert, err is:", err);
                    return reject(err);
                } else {
                    console.log("in function convert, save login success");
                    return resolve(true);
                }
            });
        }).catch(function (error) {

            console.log("catch a error in function convert, error is:", error);
        })

    });

}


var updateOne = function (tripNo, position) {
    return new Promise((resolve, reject) => {

        co(function* () {
            var tripModel = mongoose.model('gwcTrip', gwcTripSchema);
            tripModel.updateOne({
                trip_no: tripNo,
            }, {
                $push: {
                    positions: position,
                }
            }, {
                multi: true
            }, function (err, positionUpdated) {
                if (err) {
                    // logger.debug("update failed, error is:", err);
                    console.error("update failed, error is:", err);
                    return reject(err);
                } else {
                    // logger.debug("positionUpdated:", positionUpdated);
                    console.error("positionUpdated: ", positionUpdated);
                    return resolve(true); 
                }
            })
        }).catch(function (error) {

            console.log("catch a error in function convert, error is:", error);
        })

    });
}
var convert = function () {

    // 查询所有的行程数据。
    co(function* () {

        var optionsmg = {
            "user": "root",
            "pass": "Teng2017lu1109#!",
            "useNewUrlParser": true
        };
        mongoose.connect("mongodb://111.230.168.107:27017/TengitsOVMS", optionsmg);
        var tripModel = mongoose.model('gwcTrip', gwcTripSchema);
        var info = yield tripModel.find();
        fs.writeFileSync("./info.json", info);

        let positions = [];
        for (let trip of info) {
            for (let position of trip.positions) {
                let type = 0;
                if (position.data.GPS != null) {
                    type = 1;

                } else {
                    type = 2;
                }
                _.assign(position, {
                    data_type: type
                });
                positions.push(position);
            }
        }
        // console.log("in function convert, positions is:", JSON.stringify(positions));
        positions.sort(function (a, b) {
            return a.reception_time > b.reception_time ? 1 : -1;
        })
        // 依次写入数据点，判断时间间隔是否为一个小时以内
        let tmpPosition = null;
        let tripNo = null;
        for (let position of positions) {
            // if (position.reception_time )
            if (tmpPosition == null || moment(position.reception_time).diff(moment(tmpPosition.reception_time), 'hours') > 1) {
                tripNo = uuid.v4();
                let trip = new tripModel({
                    login_time: position.reception_time,
                    lost_time: moment().format("YYYY-MM-DD HH:mm:ss"),
                    imei: "0866425039671245",
                    trip_no: tripNo, // 行程编号  全局唯一标识一个行程的字段
                    positions: [position],
                });
                // trip.save(function (err) {
                //     if (err) {
                //         console.log("in function convert, err is:", err);
                //     } else {
                //         console.log("in function convert, save login success");
                //     }

                // });
                yield save(trip);
            } else {
                yield updateOne(tripNo, position);
                // tripModel.updateOne({
                //     trip_no: tripNo,
                // }, {
                //     $push: {
                //         positions: position,
                //     }
                // }, {
                //     multi: true
                // }, function (err, positionUpdated) {
                //     if (err) {
                //         // logger.debug("update failed, error is:", err);
                //         console.error("update failed, error is:", err);
                //     } else {
                //         // logger.debug("positionUpdated:", positionUpdated);
                //         console.error("positionUpdated: ", positionUpdated);
                //     }
                // })
            }
            tmpPosition = position;
        }


    }).catch(function (error) {

        console.log("catch a error in function convert, error is:", error);
    })
}
convert();