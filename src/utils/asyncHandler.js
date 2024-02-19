
//wrapper function: Takes a function as an argument and return a promise
const asyncHandler =   (requestHandler) =>{
    (req, res, next)=>{
        Promise.resolve(requestHandler(req, res, next)).catch((error)=> next(error))
    }
}   

export { asyncHandler }