// import { Comment } from "../models/commentModel.js"
// import { User } from "../models/userModel.js"
// import mongoose from "mongoose"
// export const postComment = async(req, res) => {
//     try {
//         const { userId, productId, comment, ratingStar} = req.body

//         if(!userId || !productId || !comment || !ratingStar) {
//             return res.status(404).json({message: "Required user id"})
//         }

//         const newComment = new Comment({
//             userId,
//             productId,
//             comment,
//             ratingStar
//         })

//         if(newComment) {
//             await newComment.save()

//             res.status(201).json({
//                 code: 201,
//                 data: {
//                     _id: newComment._id,
//                     productId: newComment.productId,
//                     userId: newComment.userId,
//                     comment: newComment.comment,
//                     ratingStar: newComment.ratingStar,
//                 }
//             })
//         } else {
//             res.status(400).json({error: "Invalid comment data"})
//         }
//     } catch (error) {
//         console.log(error.message)
//         res.status(500).json({error: "Internal server"})
//     }
// }

// export const getComment = async (req, res) => {
//     try {
//         const { productId } = req.params;
//         const {page = 1, limit = 3} = req.query
//         const pageNum = Number(page);
//         const limitNum = Number(limit);
//         const skip = (pageNum - 1) * limitNum;

//         const productObjectId = new mongoose.Types.ObjectId(productId);

//         const [comments, total] = await Promise.all([
//         Comment.find({
//             productId: productObjectId,
//             isActive: true,
//         })
//             .populate("userId", "name")
//             .sort({ createdAt: -1 })
//             .skip(skip)
//             .limit(limitNum)
//             .lean(),

//         Comment.countDocuments({
//             productId: productObjectId,
//             isActive: true,
//         }),
//         ]);

//         res.status(200).json({
//         code: 200,
//         data: {
//             data: comments,
//             meta: {
//                 total,
//                 page: pageNum,
//                 limit: limitNum,
//                 totalPages: Math.ceil(total / limitNum)
//             },
//         },
//         });
//     } catch (error) {
//         console.log(error.message)
//         res.status(500).json({error: "Internal server"})
//     }
// }

// export const getProductRating = async (req, res) => {
//   try {
//     const { productId } = req.params

//     const result = await Comment.aggregate([
//         { $match: { productId: new mongoose.Types.ObjectId(productId), isActive: true } },
//         {
//         $group: {
//             _id: "$ratingStar",
//             count: { $sum: 1 }
//         }
//         }
//     ])

//     const stars = { 1:0, 2:0, 3:0, 4:0, 5:0 }
//     let total = 0
//     let sum = 0

//     result.forEach(item => {
//         stars[item._id] = item.count
//         total += item.count
//         sum += item._id * item.count
//     })

//     res.json({
//         code: 200,
//         data: {
//         totalComments: total,
//         averageRating: total ? (sum / total).toFixed(1) : 0,
//         stars
//         }
//     })
//   } catch (error) {
//         console.log(error.message)
//         res.status(500).json({error: "Internal server"})
//   }
// }
