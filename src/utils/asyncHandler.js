
//wrapper function: Takes a function as an argument and return a promise
const asyncHandler =   (requestHandler) =>{
    return (req, res, next)=>{
        Promise.resolve(requestHandler(req, res, next)).catch((error)=> next(error))
    }
}   

export { asyncHandler }