import { Toaster } from "react-hot-toast"

export default function AppToaster() {
  return (
    <Toaster
      toastOptions={{
        className: "max-w-[300px] text-sm px-8 py-2",
        loading: {
          duration: 8000,
        },
        duration: 3000,
        id: "app-toaster"
      }}
      position="bottom-right"
      containerStyle={{ bottom: 30, right: 30 }}
    />
  )
}
